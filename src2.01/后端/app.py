from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import uvicorn
import geopandas as gpd
from shapely.geometry import Point, LineString, mapping
import json

app = FastAPI(title="路径规划")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 获取当前文件所在目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 获取父目录
PARENT_DIR = os.path.dirname(BASE_DIR)
# 构建POI文件路径
POI_FILE_PATH = os.path.join(PARENT_DIR, '前端', '杭州餐饮POI.json')

@app.get("/")
def get_index():
    return FileResponse("templates/index.html")

# 路径规划接口（异步，返回路线点、时长、距离）
@app.get("/api/route")
async def get_route(
    origin: str = Query(..., description="起点经纬度,如120.1,30.2"),
    destination: str = Query(..., description="终点经纬度,如120.2,30.3")
):
    key = "4c28ae0516ecbfef440117e3aadefff0"  # ⚠️ 替换为真实 key
    url = (
        f"https://restapi.amap.com/v5/direction/driving?"
        f"key={key}&origin={origin}&destination={destination}&show_fields=cost,polyline"
    )
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url)
            js = res.json()
        path = js['route']['paths'][0]
        steps = path['steps']
        pts = []
        duration = 0
        for s in steps:
            # 有些步可能没有cost字段，需容错
            if 'cost' in s and 'duration' in s['cost']:
                duration += int(s['cost']['duration'])
            pts.extend(s['polyline'].split(';'))
        coords = []
        for pt in pts:
            lon, lat = map(float, pt.split(','))
            coords.extend([lon, lat])
        return JSONResponse(content={
            "coords": coords,
            "duration": duration,     # 单位：秒
            "distance": path.get('distance', 0)      # 单位：米
        })
    except Exception as e:
        print("错误:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})

# 缓冲区分析接口
@app.get("/api/buffer-analysis")
async def buffer_analysis(
    route_coords: str = Query(..., description="路线坐标点列表，格式为'lon1,lat1;lon2,lat2;...'"),
    start_point: str = Query(..., description="起点经纬度,如120.1,30.2"),
    end_point: str = Query(..., description="终点经纬度,如120.2,30.3")
):
    try:
        # 解析路线坐标
        route_points = []
        for pt in route_coords.split(';'):
            lon, lat = map(float, pt.split(','))
            route_points.append((lon, lat))
        
        # 创建路线LineString
        route_line = LineString(route_points)
        
        # 解析起点和终点
        start_lon, start_lat = map(float, start_point.split(','))
        end_lon, end_lat = map(float, end_point.split(','))
        
        # 创建起点和终点的Point对象
        start_point = Point(start_lon, start_lat)
        end_point = Point(end_lon, end_lat)
        
        # 创建缓冲区
        route_buffer = route_line.buffer(0.002)  # 约200米
        start_buffer = start_point.buffer(0.005)  # 约500米
        end_buffer = end_point.buffer(0.005)  # 约500米
        
        # 合并缓冲区
        total_buffer = route_buffer.union(start_buffer).union(end_buffer)
        
        # 读取POI数据
        if not os.path.exists(POI_FILE_PATH):
            raise FileNotFoundError(f"POI文件不存在: {POI_FILE_PATH}")
            
        with open(POI_FILE_PATH, 'r', encoding='utf-8') as f:
            poi_data = json.load(f)
        
        # 筛选在缓冲区内的POI
        buffer_pois = []
        for poi in poi_data:
            poi_point = Point(poi['lon'], poi['lat'])
            if total_buffer.contains(poi_point):
                buffer_pois.append(poi)
        
        return JSONResponse(content={
            "buffer_pois": buffer_pois,
            "buffer_geometry": mapping(total_buffer)
        })
    except Exception as e:
        print("错误:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
