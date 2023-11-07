import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-backend-webgl';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [model, setModel] = useState(null);

  useEffect(() => {
    (async () => {
      try{
        // Request camera permission
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');

        // Initialize TensorFlow.js
        await tf.ready();

        // Load the model
        const modelJson = require('./assets/model.json');
        const modelWeights1 = require('./assets/group1-shard1of3.bin');
        const modelWeights2 = require('./assets/group1-shard2of3.bin');
        const modelWeights3 = require('./assets/group1-shard3of3.bin');
        const model = await tf.loadGraphModel(bundleResourceIO(modelJson, [modelWeights1, modelWeights2, modelWeights3]));
        setModel(model);
        console.log("Model Loaded Successfully");
      } catch (err) {
        error(err);
      }
    })();
  }, []);  

  const THRESHOLD = 0.5;

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  const handleCameraStream = (images, updatePreview, gl) => {
    const loop = async () => {
      try{

        const imageTensor = images.next().value;
      
        if (imageTensor == null) {
          requestAnimationFrame(loop);
          return;
        }

        const imageTensorFloat = imageTensor.toFloat();
        const batchedImage = imageTensorFloat.expandDims(0);

        if(model != null){
          const predictions = model.predict(batchedImage);
          predictions.array().then(array => {
            array.forEach((prediction, index) => {
              const highestProbability = Math.max(...prediction);
              if (highestProbability > THRESHOLD) {
                const labelIndex = prediction.indexOf(highestProbability);
                console.log(`Label ${labelIndex} with probability ${highestProbability}`);
              } else {
                console.log(`Prediction ${index} below threshold`);
              }
            });
          });


        }
        tf.dispose([imageTensor, imageTensorFloat, batchedImage]);
        // Update preview
        requestAnimationFrame(loop);
      } catch (error) {
        console.log("Error in handle loop : ", error);
      }

    };
    loop();
  };

  const TensorCamera = cameraWithTensors(Camera);

  let textureDims;
  if (Platform.OS === 'ios') {
   textureDims = {
     height: 1920,
     width: 1080,
   };
  } else {
   textureDims = {
     height: 1200,
     width: 1600,
   };
  }

  return (
    <View style={styles.container}>
      <TensorCamera
        style={styles.camera}
        type={Camera.Constants.Type.back}
        onReady={handleCameraStream}
        autorender={false}

        cameraTextureHeight={textureDims.height}
        cameraTextureWidth={textureDims.width}
        resizeDepth={3}
        resizeHeight={416}
        resizeWidth={416}
        
        dtype
      >
      </TensorCamera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  camera: {
    flex: 1,
    zIndex: 1
  },
});