import React, { useEffect, useState} from 'react';

// This component renders a panel with a message indicating the gamepad status

function Socket({ setGamePadStatus, setChartData, setLastDataPoint, timestamp, setTimestamp, setBrian }) {
 
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
          setTimestamp((prevTime) => {
            const newTime = prevTime + 1;
            const newData = {
              time: newTime,
              value1: Math.random() * 100,
              value2: Math.random() * 100,
              value3: Math.random() * 100,
              value4: Math.random() * 100,
            };
    
            setChartData((prevData) => {
              setLastDataPoint(newData);
              const newDataArray = [...prevData, newData];
              return newDataArray.slice(-30);
            });
    
            return newTime;
          });
        };
    
        const intervalId = setInterval(addNewData, 1000);
    
        return () => clearInterval(intervalId);
      }, [setChartData, setLastDataPoint, setTimestamp]);

      useEffect(() => {

        const addBrian = () => {
          setBrian((prevData) => {
            if(prevData.length>10) {return "goat";}
            return prevData + "!"
          });
        };

        const intervalId = setInterval(addBrian, 1000);

  
  


        return () => clearInterval(intervalId);
      }, []);

}

export default Socket;
