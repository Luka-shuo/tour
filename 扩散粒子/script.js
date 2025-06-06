// 初始化Cesium查看器
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTEyZjg5MS04MjQxLTQxYzgtYjRhNi00YTVhNWMwYmUyMDUiLCJpZCI6Mjg0ODk2LCJpYXQiOjE3NDIxODQwMTF9.ErTDrz4T5d_L89TE1oYtbWsINpVCqSQo-o5BxAf83QI'
        const viewer = new Cesium.Viewer("cesiumContainer", {
            animation:false, //动画控件
            baseLayerPicker:false, //底图选择器控件
            fullscreenButton:false, //全屏按钮
            geocoder:false, //地理位置搜索框
            homeButton:true, //回到初始位置按钮
            sceneModePicker:true, //二三维切换按钮
            timeline:false, //时间轴
            navigationHelpButton:false, //帮助按钮
            infoBox:false, //点击后弹出的信息框
            selectionIndicator:false, //点击后锁定位置的框
        });
viewer._cesiumWidget._creditContainer.style.display = "none";

// 启用深度测试和地形深度
viewer.scene.globe.depthTestAgainstTerrain = true;

// 圆扩散效果
class CircleDiffusion {
    constructor(viewer) {
        this.viewer = viewer;
        this.currentDiffusion = null;
    }
    
    add(position, scanColor, maxRadius, duration) {
        // 清除之前的扩散效果
        if (this.currentDiffusion) {
            this.viewer.scene.postProcessStages.remove(this.currentDiffusion);
        }
        
        const cartographicCenter = new Cesium.Cartographic(
            Cesium.Math.toRadians(position[0]),
            Cesium.Math.toRadians(position[1]),
            position[2]
        );
        
        scanColor = new Cesium.Color.fromCssColorString(scanColor);
        this.currentDiffusion = this._createDiffusionStage(cartographicCenter, maxRadius, scanColor, duration);
        this.viewer.scene.postProcessStages.add(this.currentDiffusion);
    }
    
    clear() {
        if (this.currentDiffusion) {
            this.viewer.scene.postProcessStages.remove(this.currentDiffusion);
            this.currentDiffusion = null;
        }
    }
    
    _createDiffusionStage(cartographicCenter, maxRadius, scanColor, duration) {
        const center = Cesium.Cartographic.toCartesian(cartographicCenter);
        const center1 = Cesium.Cartographic.toCartesian(new Cesium.Cartographic(
            cartographicCenter.longitude,
            cartographicCenter.latitude,
            cartographicCenter.height + 500
        ));
        
        const time = new Date().getTime();
        const scratchCenter = new Cesium.Cartesian4();
        const scratchCenter1 = new Cesium.Cartesian4();
        const scratchNormal = new Cesium.Cartesian3();
        
        return new Cesium.PostProcessStage({
            fragmentShader: this._getFragmentShader(),
            uniforms: {
                u_scanCenterEC: () => {
                    return Cesium.Matrix4.multiplyByVector(
                        viewer.camera._viewMatrix,
                        new Cesium.Cartesian4(center.x, center.y, center.z, 1),
                        scratchCenter
                    );
                },
                u_scanPlaneNormalEC: () => {
                    const temp = Cesium.Matrix4.multiplyByVector(
                        viewer.camera._viewMatrix,
                        new Cesium.Cartesian4(center.x, center.y, center.z, 1),
                        scratchCenter
                    );
                    
                    const temp1 = Cesium.Matrix4.multiplyByVector(
                        viewer.camera._viewMatrix,
                        new Cesium.Cartesian4(center1.x, center1.y, center1.z, 1),
                        scratchCenter1
                    );
                    
                    scratchNormal.x = temp1.x - temp.x;
                    scratchNormal.y = temp1.y - temp.y;
                    scratchNormal.z = temp1.z - temp.z;
                    Cesium.Cartesian3.normalize(scratchNormal, scratchNormal);
                    
                    return scratchNormal;
                },
                u_radius: () => {
                    return (maxRadius * ((new Date().getTime() - time) % duration)) / duration;
                },
                u_scanColor: scanColor
            }
        });
    }
    
    _getFragmentShader() {
        return `
            uniform sampler2D colorTexture;
            uniform sampler2D depthTexture;
            in vec2 v_textureCoordinates;
            uniform vec4 u_scanCenterEC;
            uniform vec3 u_scanPlaneNormalEC;
            uniform float u_radius;
            uniform vec4 u_scanColor;
            out vec4 fragColor;
            
            vec4 toEye(in vec2 uv, in float depth) {
                vec2 xy = vec2((uv.x * 2.0 - 1.0), (uv.y * 2.0 - 1.0));
                vec4 posInCamera = czm_inverseProjection * vec4(xy, depth, 1.0);
                posInCamera = posInCamera / posInCamera.w;
                return posInCamera;
            }
            
            vec3 pointProjectOnPlane(in vec3 planeNormal, in vec3 planeOrigin, in vec3 point) {
                vec3 v01 = point - planeOrigin;
                float d = dot(planeNormal, v01);
                return (point - planeNormal * d);
            }
            
            float getDepth(in vec4 depth) {
                float z_window = czm_unpackDepth(depth);
                z_window = czm_reverseLogDepth(z_window);
                float n_range = czm_depthRange.near;
                float f_range = czm_depthRange.far;
                return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
            }
            
            void main() {
                fragColor = texture(colorTexture, v_textureCoordinates);
                float depth = getDepth(texture(depthTexture, v_textureCoordinates));
                vec4 viewPos = toEye(v_textureCoordinates, depth);
                vec3 prjOnPlane = pointProjectOnPlane(u_scanPlaneNormalEC, u_scanCenterEC.xyz, viewPos.xyz);
                float dis = length(prjOnPlane - u_scanCenterEC.xyz);
                
                if(dis < u_radius) {
                    float f = 1.0 - abs(u_radius - dis) / u_radius;
                    f = pow(f, 18.0);
                    fragColor = mix(fragColor, u_scanColor, f);
                }
                
                fragColor.a = fragColor.a / 2.0;
            }
        `;
    }
}

// 初始化圆扩散控制器
const circleDiffusion = new CircleDiffusion(viewer);
const statusElement = document.getElementById('status');
let diffusionEnabled = true;

// 地图点击事件处理
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function(movement) {
    if (!diffusionEnabled) return;
    
    // 从屏幕坐标转换为地图坐标
    const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
    if (cartesian) {
        // 转换为经纬度
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        
        // 获取当前参数
        const color = document.getElementById('circleColor').value;
        const radius = parseInt(document.getElementById('circleRadius').value);
        const duration = parseInt(document.getElementById('circleDuration').value);
        
        // 添加圆扩散效果
        circleDiffusion.add([longitude, latitude, 0], color, radius, duration);
        
        // 更新状态显示
        statusElement.textContent = `在 [${longitude.toFixed(4)}, ${latitude.toFixed(4)}] 添加了圆扩散`;
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// 切换开关事件
document.getElementById('diffusionToggle').addEventListener('change', function() {
    diffusionEnabled = this.checked;
    
    // 关闭时清除所有扩散效果
    if (!diffusionEnabled) {
        circleDiffusion.clear();
        statusElement.textContent = '点击扩散: 已禁用（扩散效果已清除）';
    } else {
        statusElement.textContent = '点击扩散: 已启用';
    }
});