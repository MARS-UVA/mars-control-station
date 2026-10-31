import { act, renderHook } from '@testing-library/react';
import { EventEmitter } from 'events';
import { Service } from 'roslib';
import useRobotControl from './useRobotControl';

jest.mock('roslib', () => ({ Service: jest.fn().mockImplementation(options => ({
  ...options, callService: jest.fn(),
})) }), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  Service.mockImplementation(options => ({ ...options, callService: jest.fn() }));
});
const rosConnection = () => Object.assign(new EventEmitter(), { isConnected: true });

test('STOP always sends true, even while clear is pending', async () => {
  const ros = rosConnection();
  const { result } = renderHook(() => useRobotControl(ros));
  const estop = Service.mock.results[0].value;
  let clear, stop;
  act(() => { clear = result.current.clearEstop(); });
  act(() => { stop = result.current.estop(); });
  expect(estop.name).toBe('/robot_state/estop');
  expect(estop.callService.mock.calls.map(call => call[0])).toEqual([{ data: false }, { data: true }]);
  await act(async () => {
    estop.callService.mock.calls[1][1]({ success: true });
    expect(await stop).toBe(true);
    estop.callService.mock.calls[0][1]({ success: true });
    expect(await clear).toBe(false);
  });
  expect(result.current.error).toBeNull();
});

test('reports rejection instead of claiming teleop was enabled', async () => {
  const ros = rosConnection();
  const { result } = renderHook(() => useRobotControl(ros));
  let response;
  act(() => { response = result.current.setTeleop(true); });
  const teleop = Service.mock.results[1].value;
  expect(teleop.name).toBe('/robot_state/teleop');
  await act(async () => {
    teleop.callService.mock.calls[0][1]({ success: false, message: 'Clear E-stop first' });
    expect(await response).toBe(false);
  });
  expect(result.current.error).toBe('Clear E-stop first');
});

test('disconnect resolves pending calls as unknown and never queues service calls', async () => {
  const ros = rosConnection();
  const { result } = renderHook(() => useRobotControl(ros));
  let response;
  act(() => { response = result.current.estop(); });
  await act(async () => {
    ros.isConnected = false;
    ros.emit('close');
    expect(await response).toBe(false);
    expect(await result.current.clearEstop()).toBe(false);
  });
  expect(Service.mock.results[0].value.callService).toHaveBeenCalledTimes(1);
});
