import { act, renderHook } from '@testing-library/react';
import { EventEmitter } from 'events';
import { Action } from 'roslib';
import useManagedAction, { makeManagedGoal } from './useManagedAction';

jest.mock('roslib', () => ({ Action: jest.fn().mockImplementation(options => ({
  ...options, sendGoal: jest.fn().mockReturnValue('goal-1'), cancelGoal: jest.fn(),
})) }), { virtual: true });

const connectedRos = () => Object.assign(new EventEmitter(), { isConnected: true });

beforeEach(() => {
  jest.clearAllMocks();
  Action.mockImplementation(options => ({ ...options,
    sendGoal: jest.fn().mockReturnValue('goal-1'), cancelGoal: jest.fn() }));
});

test('uses typed manager goals, including navigation quaternion', () => {
  expect(makeManagedGoal('dig', { routineIndex: 0, timeLimit: 20 })).toMatchObject({
    operation: 1, routine_index: 0, time_limit_sec: 20,
  });
  expect(makeManagedGoal('full_auto')).toMatchObject({ operation: 3 });
  const goal = makeManagedGoal('navigate', { target: { frame: 'map', x: 1, y: 2, yaw: Math.PI } });
  expect(goal.target_pose.pose.position).toEqual({ x: 1, y: 2, z: 0 });
  expect(goal.target_pose.pose.orientation.z).toBeCloseTo(1);
  expect(() => makeManagedGoal('dig', { timeLimit: NaN })).toThrow();
  expect(() => makeManagedGoal('navigate')).toThrow();
});

test('dispatches through one endpoint and relays feedback and results', () => {
  const ros = connectedRos();
  const { result } = renderHook(() => useManagedAction(ros));
  const action = Action.mock.results[0].value;
  expect(Action).toHaveBeenCalledWith({ ros, name: '/manage_robot', actionType: 'autonomy_msgs/action/ManageRobot' });
  act(() => { expect(result.current.sendGoal('dump', { timeLimit: 30 })).toBe(true); });
  const [goal, done, feedback] = action.sendGoal.mock.calls[0];
  expect(goal).toMatchObject({ operation: 2, routine_index: 0, time_limit_sec: 30 });
  act(() => feedback({ state: 'dumping', latest_outcome: '', completed_cycles: 0, elapsed_sec: 1 }));
  expect(result.current.feedback.state).toBe('dumping');
  act(() => done({ success: true, outcome: 'SUCCESS' }));
  expect(result.current.status).toBe('succeeded');
});

test('does not replace goals or release ownership when cancellation is merely requested', () => {
  const ros = connectedRos();
  const { result } = renderHook(() => useManagedAction(ros));
  const action = Action.mock.results[0].value;
  act(() => result.current.sendGoal('dig'));
  act(() => { expect(result.current.sendGoal('dump')).toBe(false); });
  expect(action.sendGoal).toHaveBeenCalledTimes(1);
  act(() => result.current.sendGoal('dig'));
  expect(action.cancelGoal).toHaveBeenCalledWith('goal-1');
  expect(result.current.status).toBe('canceling');
  act(() => { expect(result.current.sendGoal('dump')).toBe(false); });
  act(() => action.sendGoal.mock.calls[0][3]('Goal canceled'));
  expect(result.current.status).toBe('canceled');
  expect(action.sendGoal).toHaveBeenCalledTimes(1);
});

test('disconnect marks outcome unknown and never replays a goal', () => {
  const ros = connectedRos();
  const { result } = renderHook(() => useManagedAction(ros));
  const action = Action.mock.results[0].value;
  act(() => result.current.sendGoal('dig'));
  act(() => { ros.isConnected = false; ros.emit('close'); });
  expect(result.current.status).toBe('unknown');
  ros.isConnected = true;
  act(() => { expect(result.current.sendGoal('dump')).toBe(false); });
  expect(action.sendGoal).toHaveBeenCalledTimes(1);
  act(() => result.current.acknowledgeIdle());
  act(() => { expect(result.current.sendGoal('dump')).toBe(true); });
});

test('disconnected calls send nothing and unmount does not silently cancel', () => {
  const ros = connectedRos();
  const { result, unmount } = renderHook(() => useManagedAction(ros));
  const action = Action.mock.results[0].value;
  ros.isConnected = false;
  act(() => { expect(result.current.sendGoal('dig')).toBe(false); });
  expect(action.sendGoal).not.toHaveBeenCalled();
  ros.isConnected = true;
  act(() => result.current.sendGoal('dig'));
  unmount();
  expect(action.cancelGoal).not.toHaveBeenCalled();
});
