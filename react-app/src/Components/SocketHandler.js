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

      const [lastDataRate, setLastDataRate] = React.useState(0.0);
      useEffect(() => {
        const ws = new WebSocket("ws://localhost:3001");
        ws.binaryType = "arraybuffer";
  
        ws.onopen = () => {
          const buffer = new Uint8Array([5]);
          ws.send(buffer)
          console.log('dataMonitor ws connected');
        }
  
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          const globalValue = data.global;
          console.log("Global data rate:", globalValue);
          setLastDataRate(globalValue.receiveRate + globalValue.sendRate);
        };
        return() => {
          ws.close();
        };
      }, []);

      const gyroValuesRef = useRef(new Float32Array(4));
      useEffect(() => {
        const ws = new WebSocket("ws://localhost:3001");
        ws.binaryType = "arraybuffer";
  
        ws.onopen = () => {
          const buffer = new Uint8Array([6]);
          ws.send(buffer)
          console.log('gyroMonitory ws connected');
        }
  
        ws.onmessage = (event) => {
          const buffer = event.data;
          let newValues = new Float32Array(buffer);
          gyroValuesRef.current = newValues;
        };
        return() => {
          ws.close();
        };
      }, []);

      useEffect(() => {
        const addNewData = () => {
          const motor_values = motorValuesRef.current;
          const gyro_values = gyroValuesRef.current;
          setTimestamp((prevTime) => {
            const newTime = prevTime + 1;
            const newData = {
              time: newTime,
              leftFrontWheel: motor_values[0],
              rightFrontWheel: motor_values[1],
              leftBackWheel: motor_values[2],
              rightBackWheel: motor_values[3],
              leftBucketDrum: motor_values[4],
              rightBucketDrum: motor_values[5],
              actuatorCapacity: 4.315 * (motor_values[6] + motor_values[7]) - 14.18,
              actuatorHeight: motor_values[8],
              globalDataRate: lastDataRate,
              xGyro: gyro_values[0],
              yGyro: gyro_values[1],
              zGyro: gyro_values[2],
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

      

}

export default Socket;
