import React, { useEffect } from 'react';

// This component renders a panel with a message indicating the gamepad status

function Socket({ setGamePadStatus, setChartData, setLastDataPoint }) {
    useEffect(() => {
        const handleGamepadConnected = (e) => {
          setGamePadStatus(`Gamepad connected!: ${e.gamepad.id}`);
        };
    
        const handleGamepadDisconnected = () => {
          setGamePadStatus('No gamepad connected!');
        };
    
        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
    
        return () => {
          window.removeEventListener('gamepadconnected', handleGamepadConnected);
          window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
        };
      }, []);

      useEffect(() => {

        const addNewData = () => {
          const newData = (l)=>{ return {
            time: l, // The next index as time
            value1: Math.random() * 100,
            value2: Math.random() * 100,
            value3: Math.random() * 100,
            value4: Math.random() * 100,
          }}
      
          // Set the new array (using the spread operator to create a new array)
          setChartData((prevData) => {
            let newDataPoint = newData(timestamp)
            setLastDataPoint(newDataPoint)
            setTimestamp((prevTime) => prevTime + 1)
            const newDataArray = [...prevData, newDataPoint];
            // Keep only the most recent 10 seconds of data
            return newDataArray.slice(-30);
          });
        };

        const intervalId = setInterval(addNewData, 1000);

  
  


        return () => clearInterval(intervalId);
      }, []);

}

export default Socket;
