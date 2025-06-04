from fastapi import FastAPI, File, UploadFile, Query, Body
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import geopandas as gpd
import tempfile
import json
import uvicorn
import os
from urllib import request

app = FastAPI(title="用户收藏路线/店家与路径规划")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有 HTTP 方法
    allow_headers=["*"],  # 允许所有 HTTP 头
)

# 数据目录与文件
DATA_DIR = os.path.join(os.path.dirname(__file__), "后端数据")
SHOP_FILE = os.path.join(DATA_DIR, "商家记录.json")
ROUTE_FILE = os.path.join(DATA_DIR, "路径记录.json")

def append_json(file_path, data):
    try:
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            with open(file_path, "r", encoding="utf-8-sig") as f: 
                records = json.load(f)
        else:
            records = []
        records.append(data)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"写入失败: {e}")

@app.get("/")
def get_index():
    return FileResponse("templates/index.html")

# 收藏相关接口
@app.post("/save_shop")
def save_shop(bookmark: dict = Body(...)):
    append_json(SHOP_FILE, bookmark)
    return {"msg": "商家收藏已保存"}

@app.post("/save_route")
def save_route(bookmark: dict = Body(...)):
    append_json(ROUTE_FILE, bookmark)
    return {"msg": "路线收藏已保存"}

@app.get("/search_shop")
def search_shop(name: str = Query(...)):
    try:
        with open(SHOP_FILE, "r", encoding="utf-8-sig") as f:
            records = json.load(f)
        for item in records:
            if item["name"] == name:
                return item
        return JSONResponse(status_code=404, content={"msg": "未找到该商家"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"msg": f"读取失败: {e}"})

@app.get("/search_route")
def search_route(name: str = Query(...)):
    try:
        with open(ROUTE_FILE, "r", encoding="utf-8-sig") as f:
            records = json.load(f)
        for item in records:
            if item["name"] == name:
                return item
        return JSONResponse(status_code=404, content={"msg": "未找到该路线"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"msg": f"读取失败: {e}"})

# 路径规划接口
@app.get("/api/route")
def get_route(
    origin: str = Query(..., description="起点经纬度,如120.1,30.2"),
    destination: str = Query(..., description="终点经纬度,如120.2,30.3")
):
    key = "4c28ae0516ecbfef440117e3aadefff0"  # ⚠️ 替换为真实 key，或用环境变量
    url = (
        f"https://restapi.amap.com/v5/direction/driving?"
        f"key={key}&origin={origin}&destination={destination}&show_fields=cost,polyline"
    )
    try:
        html = request.urlopen(url).read()
        js = json.loads(html)
        steps = js['route']['paths'][0]['steps']
        pts = []
        for s in steps:
            pts.extend(s['polyline'].split(';'))
        coords = []
        for pt in pts:
            lon, lat = map(float, pt.split(','))
            coords.extend([lon, lat])
        return JSONResponse(content=coords)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    # 注意：DATA_DIR 目录和 json 文件需提前创建好
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    if not os.path.exists(SHOP_FILE):
        with open(SHOP_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
    if not os.path.exists(ROUTE_FILE):
        with open(ROUTE_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
