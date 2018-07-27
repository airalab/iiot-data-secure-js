import ROSLIB from 'roslib'
import fs from 'fs'
import { forge } from 'remme-utils'
import { ROS_URL, PASSWORD } from './config'

const signingData = (privateKey, data) => {
  const md = forge.md.sha512.create();
  md.update(data, "utf8");
  return forge.util.bytesToHex(privateKey.sign(md));
}

const ros = new ROSLIB.Ros({
  url: ROS_URL
});

ros.on('connection', () => {
  console.log('Connected to websocket server.');
});

ros.on('error', (error) => {
  console.log('Error connecting to websocket server: ', error);
});

ros.on('close', () => {
  console.log('Connection to websocket server closed.');
});

const name = new ROSLIB.Param({
  ros: ros,
  name: 'sensor_name'
});

name.get((sensor_name) => {
  console.log('sensor_name: ' + sensor_name);

  const privatePem = fs.readFileSync(__dirname + '/../serts/' + sensor_name + '/private.pem');
  const privateKey = forge.pki.decryptRsaPrivateKey(privatePem, PASSWORD);

  const signed = new ROSLIB.Topic({
    ros: ros,
    name: '/input/' + sensor_name + '/signed',
    messageType: 'iiot_data_secure/Operation'
  });

  signed.subscribe((message) => {
    console.log(message.signature)
  });

  const signing = new ROSLIB.Topic({
    ros: ros,
    name: '/input/' + sensor_name + '/signing',
    messageType: 'iiot_data_secure/Operation'
  });

  signing.subscribe((message) => {
    message.signature = signingData(privateKey,
      message.nonce +
      message.data +
      message.header.stamp.secs +
      message.header.stamp.nsecs +
      message.header.frame_id +
      message.header.seq
    )
    signed.publish(message);
  });
});
