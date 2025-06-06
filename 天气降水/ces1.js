Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTEyZjg5MS04MjQxLTQxYzgtYjRhNi00YTVhNWMwYmUyMDUiLCJpZCI6Mjg0ODk2LCJpYXQiOjE3NDIxODQwMTF9.ErTDrz4T5d_L89TE1oYtbWsINpVCqSQo-o5BxAf83QI';
const viewer = new Cesium.Viewer("cesiumContainer", {
  animation: false, // 动画控件
  baseLayerPicker: false, // 底图选择器控件
  fullscreenButton: false, // 全屏按钮
  geocoder: false, // 地理位置搜索框
  homeButton: true, // 回到初始位置按钮
  sceneModePicker: true, // 二三维切换按钮
  timeline: false, // 时间轴
  navigationHelpButton: false, // 帮助按钮
  infoBox: false, // 点击后弹出的信息框
  selectionIndicator: false, // 点击后锁定位置的框
});
viewer._cesiumWidget._creditContainer.style.display = "none";

let rainEffect;

class RainEffect {
  constructor(viewer, options) {
    if (!viewer) throw new Error("no viewer object!");
    options = options || {};
    this.tiltAngle = Cesium.defaultValue(options.tiltAngle, -0.6);
    this.rainSize = Cesium.defaultValue(options.rainSize, 0.8);
    this.rainSpeed = Cesium.defaultValue(options.rainSpeed, 120.0);
    this.viewer = viewer;
    this.init();
  }

  init() {
    this.rainStage = new Cesium.PostProcessStage({
      name: "czm_rain",
      fragmentShader: this.rain(),
      uniforms: {
        tiltAngle: () => this.tiltAngle,
        rainSize: () => this.rainSize,
        rainSpeed: () => this.rainSpeed
      }
    });
    this.viewer.scene.postProcessStages.add(this.rainStage);
  }

  destroy() {
    if (!this.viewer || !this.rainStage) return;
    if (!this.rainStage.isDestroyed?.()) {
      this.rainStage.destroy();
    }
    this.viewer.scene.postProcessStages.remove(this.rainStage);
    this.rainStage = null;
  }

  show(visible) {
    if (this.rainStage) {
      this.rainStage.enabled = visible;
    }
  }

  rain() {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float tiltAngle;
      uniform float rainSize;
      uniform float rainSpeed;
      float hash(float x) {
          return fract(sin(x * 133.3) * 13.13);
      }
      out vec4 fragColor;
      void main(void) {
          float time = czm_frameNumber / rainSpeed;
          vec2 resolution = czm_viewport.zw;
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
          vec3 c = vec3(0.6, 0.7, 0.8);
          float a = tiltAngle;
          float si = sin(a), co = cos(a);
          uv *= mat2(co, -si, si, co);
          uv *= length(uv + vec2(0, 4.9)) * rainSize + 1.0;
          float v = 1.0 - sin(hash(floor(uv.x * 30.0)) * 2.0);
          float b = clamp(abs(sin(20.0 * time * v + uv.y * (5.0 / (2.0 + v)))) - 0.95, 0.0, 1.0) * 20.0;
          c *= v * b;
          fragColor = mix(texture(colorTexture, v_textureCoordinates), vec4(c, 1.0), 0.15);
      }
    `;
  }
}

// 控制函数
function startRain() {
  if (!rainEffect) {
    rainEffect = new RainEffect(viewer, {
      tiltAngle: -0.3,
      rainSize: 0.8,
      rainSpeed: 400.0
    });
  }
  rainEffect.show(true);
}

function stopRain() {
  if (rainEffect) {
    rainEffect.show(false);
  }
}

// 定义加载杭州天气的函数
async function getHangzhouWeather() {
  const lon = 120.153576; // 杭州经度
  const lat = 30.287459;  // 杭州纬度
  const weatherIcon = document.querySelector('.icon');

  const apiKey = 'e85c31783b23b441bab3e073fe394401'; 
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=zh_cn`;

  const response = await fetch(url);
  var data = await response.json();
  document.querySelector("#tem").innerHTML = data.main.temp + '°C';

  // 根据天气类型对应图标与背景
  switch (data.weather[0].main) {
    case 'Clouds':
      weatherIcon.src = 'cloudy.png';
      document.querySelector("#wea-E").innerHTML = 'cloudy';
      document.querySelector("#wea-C").innerHTML = '多云';
      break;
    case 'Clear':
      weatherIcon.src = 'sunny.png';
      document.querySelector("#wea-E").innerHTML = 'sunny';
      document.querySelector("#wea-C").innerHTML = '晴';
      break;
    case 'Rain':
      weatherIcon.src = 'rainny.png';
      document.querySelector("#wea-E").innerHTML = 'rainy';
      document.querySelector("#wea-C").innerHTML = '雨';
      startRain();
      break;
    default:
      weatherIcon.src = 'otherweather.png';
      document.querySelector("#wea-E").innerHTML = 'other';
      document.querySelector("#wea-C").innerHTML = '其他';
      break;
  }
}

// 显示杭州天气信息
let weatherTimeout;
function showWeatherPanel() {
    const panel = document.getElementById('weather-panel');
    getHangzhouWeather()
    if (weatherTimeout) clearTimeout(weatherTimeout);
    panel.classList.remove('hiding');
    panel.classList.add('visible');
    weatherTimeout = setTimeout(() => {
    panel.classList.add('hiding');
        setTimeout(() => {
        panel.classList.remove('visible');
        }, 500);
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {

    var panel = document.getElementById('weather-panel');
    // 实现天气面板的拖拽功能，记录X轴、Y轴坐标
    var dragging = false;
    var lastX;
    var lastY;
    panel.addEventListener('mousedown', function(e) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        showWeatherPanel();
    });
    document.addEventListener('mousemove', function(e) {
        if (dragging) {
            var deltaX = e.clientX - lastX;
            var deltaY = e.clientY - lastY;
            var newX = panel.offsetLeft + deltaX;
            var newY = panel.offsetTop + deltaY;
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });
    document.addEventListener('mouseup', function() {
        dragging = false;
    });
});