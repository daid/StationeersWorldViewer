from xml.etree import ElementTree as ET
import os
import json
import PIL.Image
import struct

base_paths = [
    "/home/daid/SDS/rocketstation_DedicatedServer_Data/StreamingAssets/",
    "/home/daid/SDS/mods/AsteroidBeltMod/"
]

worlds = {}
start_locations = {}
locale = {}

for base_path in base_paths:
    for path, dirs, files in os.walk(base_path):
        for file in files:
            if not file.endswith(".xml"):
                continue
            tree = ET.parse(os.path.join(path, file))
            root = tree.getroot()
            for world in root.findall("*/World"):
                for sl in world.findall("StartLocation"):
                    if (p := sl.find("Position")) != None:
                        start_locations[sl.attrib["Id"]] = p.attrib
                        start_locations[sl.attrib["Id"]]["name"] = sl.find("Name").attrib["Key"]
                if world.attrib.get("Deprecated") == "true":
                    continue
                if world.find("IsTutorial") is not None:
                    continue
                data = {
                    "start_positions": [],
                    "name": world.find("Name").attrib["Key"],
                }
                worlds[world.attrib["Id"]] = data
                for sl in world.findall("StartLocation"):
                    data["start_positions"].append(sl.attrib["Id"])
                terrain_path = os.path.join(base_path, world.find("TerrainSettings").attrib["Path"])
                if not os.path.isdir(f"data/{world.attrib['Id']}"):
                    os.makedirs(f"data/{world.attrib['Id']}", exist_ok=True)
                    os.system(f"./voxeldata {world.attrib['Id']} {terrain_path}")
                if (lava := world.find("TerrainSettings").find("Lava")) is not None:
                    data["lava"] = True
                    ymin = float(lava.attrib["MinHeight"])
                    ymax = float(lava.attrib["MaxHeight"])
                    img = PIL.Image.open(os.path.join(base_path, lava.find("HeightTexture").attrib["Path"]))
                    vertices = bytearray()
                    indices = bytearray()
                    for y in range(img.size[0]):
                        for x in range(img.size[1]):
                            p = img.getpixel((x, y))
                            vertices += struct.pack("<fff", 4096 - x * 4096 / img.size[1], ymin + (p[0] / 255) * (ymax - ymin), 4096 - y * 4096 / img.size[1])
                    for y in range(img.size[0]-1):
                        for x in range(img.size[1]-1):
                            idx = x + y * img.size[1]
                            indices += struct.pack("<HHHHHH",
                                idx+1, idx, idx + img.size[1],
                                idx + img.size[1]+1, idx+1, idx + img.size[1])
                    f = open(f"data/{world.attrib['Id']}/lava.mesh", "wb")
                    f.write(struct.pack("<II", len(vertices) // 12, len(indices) // 2))
                    f.write(vertices)
                    f.write(indices)
                    f.close()
            if root.tag == "Language":
                if root.find("Code").text == "EN":
                    for record in root.findall("*/Record"):
                        locale[record.find("Key").text] = record.find("Value").text

for sl in start_locations.values():
    sl['name'] = locale.get(sl['name'], sl['name'])
    sl['x'] = float(sl['x'])
    sl['y'] = float(sl['y'])

for world_id, world in worlds.items():
    world['name'] = locale.get(world['name'], world['name'])
    world['start_positions'] = [
        start_locations[s] for s in world['start_positions']
    ]
    world["mesh_info"] = {}
    for quality_level in range(1, 7):
        stepSize = 64 << quality_level
        data = []
        world["mesh_info"][quality_level] = data
        for x in range(0, 4096, stepSize):
            for y in range(0, 2048, stepSize):
                for z in range(0, 4096, stepSize):
                    data.append(os.path.isfile(f"data/{world_id}/{quality_level}_{x}_{y}_{z}.mesh"))
    for sp in world['start_positions']:
        x = int(2048 + sp["x"]) // 128 * 128
        z = int(2048 + sp["y"]) // 128 * 128
        y = 0
        for tmp in range(0, 2048, 128):
            if os.path.isfile(f"data/{world_id}/1_{x}_{tmp}_{z}.mesh"):
                y = tmp + 128
        sp["z"] = y

json.dump(worlds, open("worlds.json", "wt"))