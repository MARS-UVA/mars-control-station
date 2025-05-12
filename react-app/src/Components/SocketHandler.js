import React, { useEffect, useState, useRef } from 'react';
const DATA_UPDATE_DELAY_MS = 30;
const DATA_WINDOW_WIDTH = 10000 / DATA_UPDATE_DELAY_MS;
// This component will handle backend/API calls with useEffect blocks, and send the data to the UI components

function Socket({ setGamePadStatus, setChartData, setLastDataPoint, timestamp, setTimestamp, setData: setData }) {
    const motorValuesRef = useRef(new Float32Array(4));
 
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
        const MOTOR_NUM = 5;
        const ws = new WebSocket('ws://localhost:3001');
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          const buffer = new ArrayBuffer(4);
          const view = new DataView(buffer);
          view.setInt32(0, 1, true);
          ws.send(buffer);
        };
        ws.onmessage = (event) => {
          const buffer = event.data;
          let newValues = new Float32Array(buffer);
          motorValuesRef.current = newValues;
        };
        
        return () => {
          ws.close();
        };
      }, []);

      useEffect(() => {
        const addNewData = () => {
          const motor_values = motorValuesRef.current;
          setTimestamp((prevTime) => {
            const newTime = prevTime + 1;
            const newData = {
              time: newTime,
              value1: motor_values[4],
              value2: motor_values[5],
              value3: 4.57 * (motor_values[6] + motor_values[7]) - 29.8,
              value4: motor_values[8],
            };
    
            setChartData((prevData) => {
              setLastDataPoint(newData);
              const newDataArray = [...prevData, newData];
              return newDataArray.slice(-DATA_WINDOW_WIDTH);
            });
    
            return newTime;
          });
        };
    
        const intervalId = setInterval(addNewData, DATA_UPDATE_DELAY_MS);
    
        return () => clearInterval(intervalId);
      }, [setChartData, setLastDataPoint, setTimestamp]);

      useEffect(() => {

        const addData = () => {
          // setData((prevData) => {
          //   if(prevData.length>10) {return "data";}
          //   return prevData + "."
          // });
        };

        const intervalId = setInterval(addData, DATA_UPDATE_DELAY_MS);

  
  


        return () => clearInterval(intervalId);
      }, []);

}

export default Socket;
