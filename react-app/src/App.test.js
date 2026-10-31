import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockManaged = { status: 'idle', feedback: null, result: null, error: null,
  sendGoal: jest.fn(() => true), cancelGoal: jest.fn(), acknowledgeIdle: jest.fn() };
const mockControl = { pending: null, error: null, estop: jest.fn(() => Promise.resolve(true)),
  clearEstop: jest.fn(() => Promise.resolve(true)), setTeleop: jest.fn(() => Promise.resolve(true)) };
const mockRobot = { robotState: 6, robotStateName: 'IDLE', armControlMode: null };
jest.mock('./hooks/useRos', () => () => ({ ros: null, isConnected: true, status: 'connected' }));
jest.mock('./hooks/useManagedAction', () => () => mockManaged);
jest.mock('./hooks/useRobotControl', () => () => mockControl);
jest.mock('./hooks/useRobotState', () => () => mockRobot);
jest.mock('./hooks/useTelemetry', () => () => ({ lastReceived: {} }));
jest.mock('./hooks/useEspStatus', () => ({ __esModule: true, default: () => 'not_present',
  ESP_STATUS: { ONLINE: 'online', NOT_PRESENT: 'not_present' } }));
jest.mock('./hooks/useGamepadPublisher', () => ({ __esModule: true,
  default: () => ({ gamepadStatus: 'none', setLiveEnabled: jest.fn(), publishCustomFrame: jest.fn() }),
  padToGamepadState: jest.fn(), neutralGamepadState: jest.fn() }));
jest.mock('./Components/H264CameraPanel', () => () => null);
jest.mock('./Components/LiveDataPanel', () => () => null);
jest.mock('./gamepad/GamepadPanel', () => () => null);
jest.mock('./Components/DirectionChangeButton', () => () => null);
jest.mock('./Components/Socket', () => () => null);
jest.mock('./Components/WebcamPanel', () => () => null);
jest.mock('./Components/RosbridgeFeed', () => () => null);
jest.mock('./Components/Timer', () => () => null);
process.env.REACT_APP_USE_ROSBRIDGE = 'true';
const App = require('./App').default;

beforeEach(() => {
  jest.clearAllMocks();
  mockRobot.robotState = 6;
  mockControl.pending = null;
  mockControl.estop.mockResolvedValue(true);
  mockControl.clearEstop.mockResolvedValue(true);
  mockControl.setTeleop.mockResolvedValue(true);
  mockManaged.sendGoal.mockReturnValue(true);
});

test('existing dig/dump controls send manager goals without new UI controls', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Dig Auto' }));
  expect(mockManaged.sendGoal).toHaveBeenCalledWith('dig', { routineIndex: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Dump Auto' }));
  expect(mockManaged.sendGoal).toHaveBeenCalledWith('dump', { routineIndex: 0 });
  expect(screen.queryByRole('button', { name: 'Clear E-stop' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start full auto' })).not.toBeInTheDocument();
});

test('STOP engages E-stop when running and clears it when already stopped', async () => {
  const { rerender } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  expect(mockControl.estop).toHaveBeenCalledTimes(1);
  expect(mockControl.clearEstop).not.toHaveBeenCalled();
  mockRobot.robotState = 3;
  rerender(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  await waitFor(() => expect(mockControl.clearEstop).toHaveBeenCalledTimes(1));
  expect(mockManaged.acknowledgeIdle).toHaveBeenCalledTimes(1);
  expect(mockControl.setTeleop).toHaveBeenCalledWith(true);
});

test('unknown state or a pending clear always takes the stop side', () => {
  mockRobot.robotState = null;
  const { rerender } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  mockRobot.robotState = 3;
  mockControl.pending = 'Clear E-stop';
  rerender(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  expect(mockControl.estop).toHaveBeenCalledTimes(2);
  expect(mockControl.clearEstop).not.toHaveBeenCalled();
});

test('a rejected E-stop clear does not enable teleop', async () => {
  mockRobot.robotState = 3;
  mockControl.clearEstop.mockResolvedValue(false);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  await waitFor(() => expect(mockControl.clearEstop).toHaveBeenCalledTimes(1));
  expect(mockManaged.acknowledgeIdle).not.toHaveBeenCalled();
  expect(mockControl.setTeleop).not.toHaveBeenCalled();
});
