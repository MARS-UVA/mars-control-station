/*
Picks which robot's UI to show. `./start.sh --robot <name>` sets
REACT_APP_ROBOT, and this file maps that name to the robot's own app file in
src/apps/. To add a robot: create src/apps/<Name>App.js using the components in
src/Components/, add it to ROBOT_APPS below, and add the name to start.sh.
*/

import BrunoApp from './apps/BrunoApp';
import FrontloaderApp from './apps/FrontloaderApp';
import GroundDrumApp from './apps/GroundDrumApp';

const ROBOT_APPS = Object.freeze({
  bruno: BrunoApp,
  frontloader: FrontloaderApp,
  groundDrum: GroundDrumApp,
});
const DEFAULT_ROBOT = 'bruno';

const selectedRobot = process.env.REACT_APP_ROBOT || DEFAULT_ROBOT;
const App = ROBOT_APPS[selectedRobot];
if (!App) {
  throw new Error(`Unknown robot "${selectedRobot}" in REACT_APP_ROBOT. Expected one of: ${Object.keys(ROBOT_APPS).join(', ')}.`);
}

export default App;
