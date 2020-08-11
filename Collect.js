import React, { 
  Component
} from 'react';
import {
  DeviceEventEmitter,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { 
  accelerometer, 
  gyroscope, 
  magnetometer,
  setUpdateIntervalForType, 
  SensorTypes 
} from "react-native-sensors";
import { 
  RNCamera 
} from 'react-native-camera';
import {
  PastNumberSchema,
  SaveSchema,
  CollectedDataDataSchema,
  AccSchema,
  MagSchema,
  GyroSchema,
  XyzSchema,
  BeaconSchema,
  BeaconDataSchema,
  WifiSchema,
  WifiDataSchema,
} from './test1/schema.js'
import Beacons from 'react-native-beacons-manager'
import wifi from 'react-native-android-wifi';
import CameraRoll from "@react-native-community/cameraroll";
import moment from 'moment';
import Realm from 'realm';
import RNFetchBlob from 'react-native-fetch-blob';
import checkFirstLaunch from './test1/checkFirstLaunch';

// 회전각 측정
export const calculateAngle = (acc, gyr, angleTime, beforeTotalAngle) => new Promise((resolve) => {
  const radianPerSecond = (acc['x'] * gyr['x'] + acc['y'] * gyr['y'] + acc['z'] * gyr['z'])
    / Math.sqrt(Math.pow(acc['x'], 2) + Math.pow(acc['y'], 2) + Math.pow(acc['z'], 2));   // sqrt는 루트, pow는 제곱

  let multiply = -1;
  const degreePerSecond = multiply * radianPerSecond * 180 / 3.141592;  // 초당 radian 값에서 초당 degree값으로 변경
  let changeDegree = degreePerSecond * (angleTime[angleTime.length - 1] - angleTime[angleTime.length - 2]) / 1000; // 이를 적분하여 변화하는 degree를 구함.
  if (changeDegree < 0.07 && changeDegree > -0.07) { // 오차를 줄이기 위해 변화하는 degree 값의 범위를 준다.
    changeDegree = 0; // degree 변화량이 주어진 범위를 넘지 못하면 degree 변화량을 0으로 하여 회전이 일어나지 않도록 한다.
  }
  let afterTotalAngle = beforeTotalAngle + changeDegree;
  if (afterTotalAngle < 0) {
    afterTotalAngle += 360;
  } else if (afterTotalAngle > 360) {
    afterTotalAngle -= 360;
  }
  resolve({
    degree: afterTotalAngle,
  });

})

// 비콘 identifier 관련
const region = {
  identifier: 'allFloor',
}

// 녹화 시작, 끝 시간
let recordStartTime;
let recordEndTime;

// 가속도, 지자기, 자이로 측정 관련
let accSubscription;
let magSubscription;
let gyroSubscription;

// past(Object)Number - 이전 오브젝트의 수, now(Object)Number - 이전 + 현재 오브젝트의 수
let pastAccNumber;
let nowAccNumber;
let pastMagNumber;
let nowMagNumber;
let pastGyroNumber;
let nowGyroNumber;
let pastBeaconNumber;
let nowBeaconNumber;
let pastWifiNumber;
let nowWifiNumber;


export class Collect extends Component {
  constructor(props) {
    super(props);
    this.state = {
      accState: {x: 0, y: 0, z: 0},
      magState: {x: 0, y: 0, z: 0},
      gyroState: {x: 0, y: 0, z: 0},
      collectState:'stop',
      autoFocus: 'on',
      type: 'back', 
      ratio: '16:9',
      ratios: [],
      recordOptions: {
        mute: false,
        quality: RNCamera.Constants.VideoQuality["720p"],
      },
      isRecording: false,
      realm: null,
      isFirstLaunch: false,
    };
  }

  // componentWillMount(){
  // }

  // realm.writeCopyTo('/mnt/sdcard/Android/data/com.project_data/files/default.realm');  //realm db 추출

  
  async componentDidMount() {
    // 앱 실행 시 데이터 초기화
    // Realm.deleteFile({schema:[AccSchema,MagSchema,GyroSchema,XyzSchema,BeaconSchema,BeaconDataSchema,WifiSchema,WifiDataSchema]});    

    //앱 최초 실행 관련
    const isFirstLaunch = await checkFirstLaunch();
    console.log('Is this first launch? : ' + JSON.stringify(isFirstLaunch));
    if(isFirstLaunch){
      console.log( ' This is first launch.'+ isFirstLaunch.toString() );

      // 안드로이드 권한 관련 ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
      if (Platform.OS === 'android') {                                                                                                  ///
        const granted = PermissionsAndroid.requestMultiple(                                                                             ///
          [PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,                                                                       ///
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,                                                                          ///
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,                                                                                  ///
          PermissionsAndroid.PERMISSIONS.CAMERA]                                                                                        ///
        ).then((result) => {                                                                                                            ///
          if (result['android.permission.WRITE_EXTERNAL_STORAGE'] === 'granted'                                                         ///
          && result['android.permission.ACCESS_FINE_LOCATION'] === 'granted'                                                            ///
          && result['android.permission.RECORD_AUDIO'] === 'granted'                                                                    ///
          && result['android.permission.CAMERA'] === 'granted')                                                                         ///
          {                                                                                                                             ///
            let permissionAllowed = new Date().getTime();                                                                               ///
            alert(moment(permissionAllowed).format('YYYY년 MM월 DD일 HH시 mm분 \n\n 모든 권한이 허락되었습니다. 앱 사용이 가능합니다.'));    ///
          }                                                                                                                             ///
          else                                                                                                                          ///
          {                                                                                                                             ///
            let permissionDenied = [];                                                                                                  ///
            if(result['android.permission.WRITE_EXTERNAL_STORAGE'] === 'granted'){                                                      ///
              console.log("PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE : true");                                              ///
            }                                                                                                                           ///
            else{                                                                                                                       ///
              permissionDenied.push('저장소');                                                                                           ///
              console.log("PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE : false");                                             ///
            }                                                                                                                           ///
            if(result['android.permission.ACCESS_FINE_LOCATION'] === 'granted'){                                                        ///
              console.log("PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION : true");                                                ///
            }                                                                                                                           ///
            else{                                                                                                                       ///
              permissionDenied.push('위치');                                                                                            ///
              console.log("PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION : false");                                               ///
            }                                                                                                                           ///
            if(result['android.permission.RECORD_AUDIO'] === 'granted'){                                                                ///
              console.log("PermissionsAndroid.PERMISSIONS.RECORD_AUDIO : true");                                                        ///
            }                                                                                                                           ///
            else{                                                                                                                       ///
              permissionDenied.push('마이크');                                                                                           ///
              console.log("PermissionsAndroid.PERMISSIONS.RECORD_AUDIO : false");                                                       ///
            }                                                                                                                           ///
            if(result['android.permission.CAMERA'] === 'granted'){                                                                      ///
              console.log("PermissionsAndroid.PERMISSIONS.CAMERA : true");                                                              ///
            }                                                                                                                           ///
            else{                                                                                                                       ///
              permissionDenied.push('카메라');                                                                                           ///
              console.log("PermissionsAndroid.PERMISSIONS.CAMERA : false");                                                             ///
            }                                                                                                                           ///
            alert(String(permissionDenied) + ' 권한\n이 불허되었습니다. \n\n어플이 정상 작동하지 않을 수 있습니다. \n\n정상 작동을 위해서 권한을 부여해주시기 바랍니다. \n\n앱 -> 앱 정보 -> 권한 -> 권한 부여\n\n');
          }                                                                                                                             ///
        });                                                                                                                             ///
      }                                                                                                                                 ///
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      this.setState({isFirstLaunch: true});
    }
  }

  checkData(){
    // 과거 데이터 길이 확인
    this.checkPastNumber();

    //센서, 비콘, 와이파이, 블루투스 측정
    this.checkSensor();
    this.checkBeacon();
    this.checkWifi();
  }

  stopCheckData(){
    //센서 측정 비활성
    accSubscription.unsubscribe();
    magSubscription.unsubscribe();
    gyroSubscription.unsubscribe();
    this.angFinal = 0;

    // 비콘 측정 비활성
    Beacons.stopRangingBeaconsInRegion(region);
    this.beaconsDidRange.remove();

    // 와이파이 측정 비활성
    clearInterval(this.wifiInterval);

    // 열려있는 realm 닫아줌
    const {realm} = this.state;
    if (realm !== null && !realm.isClosed) {
      realm.close();
    }
  }

  checkSensor(){
    // 센서 측정 간격 250ms
    setUpdateIntervalForType(SensorTypes.accelerometer,250);
    setUpdateIntervalForType(SensorTypes.magnetometer,250);
    setUpdateIntervalForType(SensorTypes.gyroscope,250);

    // 센서 측정 및 상태 업데이트
    let angleTime = [];
    let startAngle = 0;
    this.angFinal = 0;
    
    // 가속도, 지자기, 자이로 및 각 측정
    accSubscription = accelerometer.subscribe(({ x, y, z }) =>{ 
      this.setState({accState: {x, y, z}});

      this.angFinal = startAngle;
      angleTime.push(new Date().getTime());  
      if (this.state.accState != null && this.state.gyroState != null && angleTime.length > 2) {
        calculateAngle(this.state.accState, this.state.gyroState, angleTime, this.angFinal)
        .then((res) => {
        this.angFinal = res.degree;
        })
      }

      Realm.open({schema:[AccSchema,XyzSchema]})
      .then(realm => {
        realm.write(() => {
          let accTime = new Date().getTime();
          let accSensor =realm.create('AccSensor', {
            accDate: moment(accTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
            accInterval: JSON.stringify(((accTime -  recordStartTime) / 1000).toFixed(1)),
            accXyz: [{x:this.state.accState.x, y:this.state.accState.y, z:this.state.accState.z}],
            degree: this.angFinal,
          });
        });  
        realm.close();
      });
    });

    magSubscription = magnetometer.subscribe(({ x, y, z }) =>{                                  
      this.setState({magState: {x, y, z}});

      Realm.open({schema:[MagSchema,XyzSchema]})
      .then(realm => {
        realm.write(() => {
          magTime = new Date().getTime();
          let magSensor =realm.create('MagSensor', {
            magDate: moment(magTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
            magInterval: JSON.stringify(((magTime -  recordStartTime) / 1000).toFixed(1)),
            magXyz: [{x:this.state.magState.x, y:this.state.magState.y, z:this.state.magState.z}],
            degree: this.angFinal,
          });
        });  
        realm.close();
      });
    });

    gyroSubscription = gyroscope.subscribe(async({ x, y, z }) =>{
      this.setState({gyroState: {x, y, z}});

      this.angFinal = startAngle;
      angleTime.push(new Date().getTime());  
      if (this.state.accState != null && this.state.gyroState != null && angleTime.length > 2) {
        calculateAngle(this.state.accState, this.state.gyroState, angleTime, this.angFinal)
        .then((res) => {
        this.angFinal = res.degree;
        })
      }

      Realm.open({schema:[GyroSchema,XyzSchema]})
      .then(realm => {
        realm.write(() => {
          gyroTime = new Date().getTime();
          let gyroSensor =realm.create('GyroSensor', {
            gyroDate: moment(gyroTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
            gyroInterval: JSON.stringify(((gyroTime -  recordStartTime) / 1000).toFixed(1)),
            gyroXyz: [{x:this.state.gyroState.x, y:this.state.gyroState.y, z:this.state.gyroState.z}],
            degree: this.angFinal,
          });
          // defalutPath는 /data/data/com.project_data/files/default.realm 임.
        }); 
        realm.close(); 
      });
    });
  }

  checkBeacon(){
    // 비콘 데이터 수집
      Beacons.detectIBeacons();
      Beacons.setForegroundScanPeriod(250);
      Beacons.startRangingBeaconsInRegion(region)
      .then(() => {
        this.beaconsDidRange = DeviceEventEmitter.addListener('beaconsDidRange', (data) => {

          let beaconTime = new Date().getTime();
          for (let i = 0; i < data.beacons.length; i++) {
            Realm.open({schema:[BeaconSchema,BeaconDataSchema]})
            .then(realm => {
              realm.write(() => {
                let beacon =realm.create('Beacon', {
                  beaconDate: moment(beaconTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
                  beaconInterval: JSON.stringify(((beaconTime -  recordStartTime) / 1000).toFixed(1)),
                  beaconData: [{
                    distance: data.beacons[i].distance, 
                    major: data.beacons[i].major, 
                    minor: data.beacons[i].minor, 
                    proximity: data.beacons[i].proximity, 
                    rssi: data.beacons[i].rssi, 
                    uuid: data.beacons[i].uuid,
                  }]
                });
              });
              realm.close();  
            });
          }     
        })
      })      
    /* vestella's beacons data
    {"distance": 2.415400919773938, "major": 100, "minor": 3, "proximity": "near", "rssi": -79, "uuid": "e2c56db5-dffb-48d2-b060-d0f5a71096e0"}
    {"distance": 2.540422357897728, "major": 100, "minor": 2, "proximity": "near", "rssi": -74, "uuid": "e2c56db5-dffb-48d2-b060-d0f5a71096e0"}
    {"distance": 3.1123061960095377, "major": 100, "minor": 4, "proximity": "far", "rssi": -74, "uuid": "e2c56db5-dffb-48d2-b060-d0f5a71096e0"}
    {"distance": 2.328135124768006, "major": 100, "minor": 1, "proximity": "near", "rssi": -69, "uuid": "e2c56db5-dffb-48d2-b060-d0f5a71096e0"}
  
    distance는 meter 단위
    proximity - 0.5미터 이내의 거리는 “immediate”, 0.5~3m 정도는 “near”, 그 이상은 “far”
    */
  }

  checkWifi(){
    // Wifi 데이터 수집
    this.wifiInterval = setInterval(() => {
      wifi.reScanAndLoadWifiList((wifiStringList) => {
        var wifiArray = JSON.parse(wifiStringList);
        let wifiTime = new Date().getTime();

        for(let countWifi = 0;countWifi<wifiArray.length;countWifi++){
          Realm.open({schema:[WifiSchema,WifiDataSchema]})
          .then(realm => {
            realm.write(() => {
              let wifi =realm.create('Wifi', {
                wifiDate: moment(wifiTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
                wifiInterval: JSON.stringify(((wifiTime -  recordStartTime) / 1000).toFixed(1)),
                wifiData: [{
                  BSSID:wifiArray[countWifi].BSSID, 
                  SSID:wifiArray[countWifi].SSID,
                  capabilities:wifiArray[countWifi].capabilities,
                  frequency:wifiArray[countWifi].frequency,
                  level:wifiArray[countWifi].level,
                }],
              });
            });  
            realm.close();
          });
        }
      },
      (error) => {
        console.log(error);
      });  
      
      // 와이파이 측정 간격 4800ms    
    }, 4800);
    /* wifi data
    {"BSSID": "d8:47:32:31:c0:02", "SSID": "ves-5G", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 5785, "level": -42, "timestamp": 11749716879}, 
    {"BSSID": "a0:ab:1b:8c:3c:72", "SSID": "ves2-5GHz", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 5220, "level": -59, "timestamp": 11749716995}, 
    {"BSSID": "50:c7:bf:dc:d0:f4", "SSID": "TP-LINK_D0F4", "capabilities": "[WPA2-PSK-CCMP][WPS][ESS]", "frequency": 2427, "level": -68, "timestamp": 11749716904}, 
    {"BSSID": "d8:47:32:31:c0:03", "SSID": "ves-2G", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 2437, "level": -32, "timestamp": 11749716941}, 
    {"BSSID": "a0:ab:1b:8c:3c:70", "SSID": "ves2-2G", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 2462, "level": -32, "timestamp": 11749716929}, 
    {"BSSID": "86:25:19:9f:76:22", "SSID": "DIRECT-FGC48x Series", "capabilities": "[WPA2-PSK-CCMP][WPS][ESS]", "frequency": 2412, "level": -44, "timestamp": 11749716829}, 
    {"BSSID": "88:3c:1c:c6:7c:80", "SSID": "KT_GiGA_2G_Wave2_7C7C", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 2427, "level": -72, "timestamp": 11749716917},
    {"BSSID": "08:5d:dd:89:b2:57", "SSID": "olleh_WiFi_B253", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 2412, "level": -72, "timestamp": 11749716853}, 
    {"BSSID": "88:3c:1c:7f:de:f5", "SSID": "KT_GiGA_2G_DEF1", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 2422, "level": -72, "timestamp": 11749716892}, 
    {"BSSID": "00:e1:40:15:09:fa", "SSID": "janus_bb_gw200_1509FA", "capabilities": "[WPA2-PSK-CCMP][WPS][ESS]", "frequency": 2437, "level": -75, "timestamp": 11749716952}, 
    {"BSSID": "88:3c:1c:aa:6a:0d", "SSID": "KT_GiGA_2G_Wave2_6A09", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][WPS][ESS]", "frequency": 2437, "level": -79, "timestamp": 11749716965}, 
    {"BSSID": "08:5d:dd:89:b2:56", "SSID": "olleh_GiGA_WiFi_B253", "capabilities": "[WPA-PSK-CCMP+TKIP][WPA2-PSK-CCMP+TKIP][ESS]", "frequency": 5180, "level": -89, "timestamp": 11749716978}, 
    {"BSSID": "88:36:6c:7e:87:76", "SSID": "iptime", "capabilities": "[WPS][ESS]", "frequency": 2417, "level": -75, "timestamp": 11749716865}
    
    "BSSID": 엑세스 포인트의 주소,    
    "SSID": 네트워크 이름,
    "capabilities": 엑세스 포인트에서 제공하는 authentication, key management, encryption schemes
    "frequency": 엑세스 포인트에서 사용자와 상호작용하는 주파수
    "level": dB단위, RSSI를 의미
    "timestamp": 결과가 나왔을 때의 시간(ms단위)
    */
  }

  // csv 파일 생성 관련
  createDataFile = (name, values) =>{
    var realName = name.split('.');   

    // csv로 변환
    const headerString = 'Index,Action,TimeStamp,Object,// Reference is Action\n';
    const rowString = values;
    const csvString = `${headerString}${rowString}`;
    const pathToWrite = `/mnt/sdcard/Android/data/com.project_data/files/Data_${realName[0]}.csv`;

    RNFetchBlob.fs
    .createFile(pathToWrite, csvString, 'utf8')
    .then(() => {
      console.log(`csv file create complete! :Data_${realName[0]}.csv`);
    })
    .catch(error => console.error(error));  
  }

  // 시간 순으로 정렬된 파일 생성 관련
  createSortedFile = (name, values) =>{
    var realName = name.split('.');  
    
    // csv로 변환
    const headerString = 'Index,Action,TimeStamp,Object,// Reference is Action\n';
    const rowString = values;
    const csvString = `${headerString}${rowString}`;
    const pathToWrite = `/mnt/sdcard/Android/data/com.project_data/files/Sorted_${realName[0]}.csv`;

    RNFetchBlob.fs
    .createFile(pathToWrite, csvString, 'utf8')
    .then(() => {
      console.log(`csv file create complete! :Sorted_${realName[0]}.csv`);
      alert(`csv file create complete!\n\nSorted_${realName[0]}.csv\n`);
    })
    .catch(error => console.log(error),alert("Error : file already exist!"));
  }

  extractSortedFile = () => {
    Realm.open({schema:[PastNumberSchema,SaveSchema,CollectedDataDataSchema,AccSchema,MagSchema,GyroSchema,XyzSchema,BeaconSchema,BeaconDataSchema,WifiSchema,WifiDataSchema]})
    .then(realm => {
      var movieName = realm.objects('Save')[realm.objects('Save').length-1].recordName;
      this.createSortedFile(movieName,this.sortByDate(this.modifyToCsv(JSON.stringify(realm.objects('Save')[realm.objects('Save').length-1]))));
      realm.close();
    });
  }

  // csv파일에 저장할 데이터 다듬기
  modifyToCsv = dataString => {
    var result;

    // 엑셀로 출력할 데이터 형식 다듬기
    result = dataString.replace(/":/g,',');
    result = result.replace('{"','');
    result = result.replace(/"/g,'');
    result = result.replace(/"/g,'');
    result = result.replace('recordStart',',recordStart');
    result = result.replace('recordEnd','\n,recordEnd');
    result = result.replace('recordName','\n,recordName');
    result = result.replace('collectedData,{0,{accData,{','\n');
    result = result.replace('}},magData,{','\n');
    result = result.replace('}},gyroData,{','\n');
    result = result.replace('}},beaconData,{','\n');
    result = result.replace('}},wifiData,{','\n');
    result = result.replace(/}},degree/g,',degree');
    result = result.replace(/}},serviceData/g,',serviceData');
    result = result.replace(/}},serviceUUIDs/g,',serviceUUIDs');
    result = result.replace(/},serviceUUIDs/g,',serviceUUIDs');
    result = result.replace(/}},id/g,',id');
    result = result.replace(/},\\/g,',\\');
    result = result.replace(/},/g,'\n');
    result = result.replace(/}/g,'');
    result = result.replace(/{/g,'');
    result = result.replace(/\\/g,'');

    return result;
  }

  // 데이터 정렬
  sortByDate = (beforSortData) => {
    let afterSortData = beforSortData.split('\n');

    // 시간 순으로 정렬
    afterSortData.sort(function (a,b){
      if(a.split(',')[2] > b.split(',')[2]){
        return 1;
      }
      if(a.split(',')[2] < b.split(',')[2]){
        return -1;
      }
      return 0;
    });  

    // aftersortData를 string으로 변환
    afterSortData = JSON.stringify(afterSortData);
    
    // 엑셀로 출력할 데이터 형식 다듬기
    afterSortData = afterSortData.replace(/",record/g,',record');
    afterSortData = afterSortData.replace(/",/g,'\n');
    afterSortData = afterSortData.replace(/\[/g,'');
    afterSortData = afterSortData.replace(/\]/g,'');
    afterSortData = afterSortData.replace(/"/g,'');
    return afterSortData;
  }
  
  // txt로 출력할 데이터
  forTxt = (data) => {
    let datatemp = data.split('\n');
    removedUselessData = JSON.stringify(datatemp);
    removedUselessData = removedUselessData.replace(/",record/g,',record');
    removedUselessData = removedUselessData.replace(/",/g,'\n');
    removedUselessData = removedUselessData.replace(/\[/g,'');
    removedUselessData = removedUselessData.replace(/\]/g,'');
    removedUselessData = removedUselessData.replace(/"/g,'');
    removedUselessData = removedUselessData.replace(/,/g,':');
    return removedUselessData;
  }

    // txt 파일 생성 관련
    createTxtFile = (name, values) =>{
      var realName = name.split('.');  
      
      // txt로 변환
      const rowString = values;
      const csvString = `${rowString}`;
      const pathToWrite = `/mnt/sdcard/Android/data/com.project_data/files/${realName[0]}.txt`;
  
      RNFetchBlob.fs
      .createFile(pathToWrite, csvString, 'utf8')
      .then(() => {
        console.log(`txt file create complete! :${realName[0]}.txt`);
        alert(`txt file create complete!\n\n${realName[0]}.txt\n`);
      })
      .catch(error => console.log(error),alert("Error : file already exist!"));
    }
  
    extractTxtFile = () => {
      Realm.open({schema:[PastNumberSchema,SaveSchema,CollectedDataDataSchema,AccSchema,MagSchema,GyroSchema,XyzSchema,BeaconSchema,BeaconDataSchema,WifiSchema,WifiDataSchema]})
      .then(realm => {
        var movieName = realm.objects('Save')[realm.objects('Save').length-1].recordName;
        this.createTxtFile(movieName,this.forTxt(this.modifyToCsv(JSON.stringify(realm.objects('Save')[realm.objects('Save').length-1]))));
        realm.close();
      });
    }

  // 카메라 녹화 관련////////////////////////////////////////////////////////////////////
  getRatios = async function() {
    const ratios = await this.camera.getSupportedRatios();
    return ratios;
  };

  setRatio(ratio) {
    this.setState({
      ratio,
    });
  }

  takeVideo = async function() {
    if (this.camera) {
      recordStartTime = new Date().getTime();
      try {
        const record = this.camera.recordAsync(this.state.recordOptions);

        if (record) {
          console.log("Record Start!");
          
          // 녹화 시작
          if (this.state.collectState == 'stop') {
            this.setState({ collectState: 'collect' })
            
            // 녹화 시 checkData
            this.checkData();   
          }
          this.setState({ isRecording: true });
          const recordData = await record;

          // 녹화 끝
          if (this.state.collectState == 'collect') {
            this.setState({ collectState: 'stop' })

            //녹화 종료 시 stopCheckData
            this.stopCheckData();   
          }
          this.setState({ isRecording: false });
          var uriTemp = recordData.uri.split('/');

          //영상 이름 'sample.mp4'
          let movieName = uriTemp[9]; 

          //데이터 저장 및 파일 생성
          this.saveData(movieName);       

          CameraRoll.save(recordData.uri,{type:'video',album: 'Project_Data'})
          .then(() => {
            console.log("Movie Recorded!");
            alert("Movie Recorded!");
          })
          .catch(function() {
            console.log("Promise Rejected");  
            alert("Promise Rejected");                    
          })

        }
      } catch (e) {
        console.warn(e);
      }
    }
  }

  saveData =(movieName) =>{
    // 데이터 저장 및 파일 생성
    Realm.open({schema:[PastNumberSchema,SaveSchema,CollectedDataDataSchema,AccSchema,MagSchema,GyroSchema,XyzSchema,BeaconSchema,BeaconDataSchema,WifiSchema,WifiDataSchema]})
    .then(realm => {
      realm.write(() => {
        recordEndTime = new Date().getTime();

        //직전 실행까지 측정한 각 데이터들 길이 저장
        pastAccNumber = realm.objects('PastNumber')[realm.objects('PastNumber').length - 1].pastAccNumberSave;
        pastMagNumber = realm.objects('PastNumber')[realm.objects('PastNumber').length - 1].pastMagNumberSave;
        pastGyroNumber = realm.objects('PastNumber')[realm.objects('PastNumber').length - 1].pastGyroNumberSave;
        pastBeaconNumber = realm.objects('PastNumber')[realm.objects('PastNumber').length - 1].pastBeaconSave;
        pastWifiNumber = realm.objects('PastNumber')[realm.objects('PastNumber').length - 1].pastWifiSave;


        //현재까지 측정한 각 데이터들 길이 저장
        nowAccNumber = realm.objects('AccSensor').length;
        nowMagNumber = realm.objects('MagSensor').length;
        nowGyroNumber = realm.objects('GyroSensor').length;
        nowBeaconNumber = realm.objects('Beacon').length;
        nowWifiNumber = realm.objects('Wifi').length;

        // (Object)Temp는 잠시 수집한 데이터를 저장하는 배열
        let accTemp = [];
        let magTemp = [];
        let gyroTemp = [];
        let beaconTemp = [];
        let wifiTemp = [];

        // 수집한 데이터를 임시 배열에 저장
        for(let i= pastAccNumber;i<nowAccNumber;i++){
          accTemp.push(realm.objects('AccSensor')[i]);
        }   
        for(let i= pastMagNumber;i<nowMagNumber;i++){
          magTemp.push(realm.objects('MagSensor')[i]);
        }  
        for(let i= pastGyroNumber;i<nowGyroNumber;i++){
          gyroTemp.push(realm.objects('GyroSensor')[i]);
        }    
        for(let i= pastBeaconNumber;i<nowBeaconNumber;i++){
          beaconTemp.push(realm.objects('Beacon')[i]);
        }    
        for(let i= pastWifiNumber;i<nowWifiNumber;i++){
          wifiTemp.push(realm.objects('Wifi')[i]);
        }    

        // 데이터 저장
        let save = realm.create('Save', {
          recordStart: moment(recordStartTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
          recordEnd: moment(recordEndTime).format('YYYY-MM-DDTHH:mm:ss.SSS'),
          recordName: movieName,
          collectedData:[{
            accData: accTemp,
            magData: magTemp,
            gyroData: gyroTemp,
            beaconData: beaconTemp,
            wifiData: wifiTemp,
          }],
        });
      })
      
      // 데이터 csv파일 생성 
      this.createDataFile(movieName,this.modifyToCsv(JSON.stringify(realm.objects('Save')[realm.objects('Save').length-1])));

      console.log("'Saved File' Length :" + realm.objects('Save').length);
      console.log("Acc: " + pastAccNumber + " / " + nowAccNumber);
      console.log("Mag: " + pastMagNumber + " / " + nowMagNumber);
      console.log("Gyro: " + pastGyroNumber + " / " + nowGyroNumber);
      console.log("Beacon: " + pastBeaconNumber + " / " + nowBeaconNumber);
      console.log("Wifi: " + pastWifiNumber + " / " + nowWifiNumber);
      
      realm.close();
    })
  }

  checkPastNumber(){
    //직전 실행까지 측정한 각 데이터들 길이를 데이터베이스에 저장
    Realm.open({schema:[PastNumberSchema,SaveSchema,CollectedDataDataSchema,AccSchema,MagSchema,GyroSchema,XyzSchema,BeaconSchema,BeaconDataSchema,WifiSchema,WifiDataSchema]})
    .then(realm => {
      realm.write(() => {
        let PastNumber = realm.create('PastNumber', {
          pastAccNumberSave: realm.objects('AccSensor').length,
          pastMagNumberSave: realm.objects('MagSensor').length,
          pastGyroNumberSave: realm.objects('GyroSensor').length,
          pastBeaconSave: realm.objects('Beacon').length,
          pastWifiSave: realm.objects('Wifi').length,
        })
      })
      realm.close();
    })
  }
////////////////////// 들여쓰기 해야함
  DataInfo () {
    Realm.open({schema:[PastNumberSchema,SaveSchema,CollectedDataDataSchema,AccSchema,MagSchema,GyroSchema,XyzSchema,BeaconSchema,BeaconDataSchema,WifiSchema,WifiDataSchema]})
    .then(realm => {
      realm.write(() => {
        alert(
          "movie name :\n" + realm.objects('Save')[realm.objects('Save').length-1].recordName + "\n\n" + 
          "record start time :\n" + realm.objects('Save')[realm.objects('Save').length-1].recordStart + "\n\n" + 
          "record end time :\n" + realm.objects('Save')[realm.objects('Save').length-1].recordEnd + "\n\n" + 
          "run time :\n" + (moment(realm.objects('Save')[realm.objects('Save').length-1].recordEnd) - moment(realm.objects('Save')[realm.objects('Save').length-1].recordStart))/1000 + "sec\n"
          );
        })
      realm.close();
    })  }

  renderCamera() {
    return (
      <RNCamera
        ref={ref => {
          this.camera = ref;
        }}
        style={{
          flex: 1,
        }}
        type={this.state.type}
        autoFocus={this.state.autoFocus}
        whiteBalance={this.state.whiteBalance}
        ratio={this.state.ratio}
      >
        <View
          style={{
            flex: 0.9,
          }}
        >
        </View>
        <View
          style={{
            flex: 0.1,
            backgroundColor: 'transparent',
            flexDirection: 'row',
            alignSelf: 'center',
          }}
        >
          <TouchableOpacity
            style={[styles.flipButton, { 
              flex: 0.3, 
              alignSelf: 'center',
              backgroundColor: this.state.isRecording ? 'darkgreen' : 'darkred',
            }]}
            onPress={this.state.isRecording ? () => this.camera.stopRecording() : this.takeVideo.bind(this)}
          >
            {
              this.state.isRecording ?
              <Text style={styles.flipText}> ING </Text>
              :
              <Text style={styles.flipText}> REC </Text>
            }
          </TouchableOpacity>
        </View>
      </RNCamera>
    );
  }
  //////////////////////////////////////////////////////////////////////////////////////
  componentWillUnmount() {
    
  }

  render() {
    
    return (
    <View style={styles.container}>
      <Text style={styles.warningText}>
      주의: 영상종료 버튼은 단 한 번만 누르고 기다리시오. 녹화완료 알람이 뜨기 전까지 강제종료하지 마시오.
      </Text>
      {this.renderCamera()}
    </View>    
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  warningText:{
    width: 350,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#01DFD7',
  },
  flipButton: {
    flex: 0.3,
    height: 40,
    marginHorizontal: 2,
    marginBottom: 10,
    marginTop: 20,
    borderRadius: 5,
    borderColor: '#000000',
    borderWidth: 1,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipText: {
    color: 'white',
    fontSize: 15,
  },
  valueContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  valueValue: {
    width: 200,
    fontSize: 15,
    color: '#01DFD7',
  },
  valueName: {
    width: 60,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#01DFD7',
  },
  row: {
    flexDirection: 'row',
  },
});

const collectClass = new Collect();
export default collectClass;