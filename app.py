from flask import Flask, render_template, request, jsonify, send_from_directory
import subprocess
import cv2
import base64
import json
import os

app = Flask(__name__)

video_path = ""
video_frames = []
frame_annotations = []


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/labels", methods=["GET"])
def get_labels():
    with open("annotation_labels.json") as file:
        labels = json.load(file)
    return jsonify(labels)


def extract_audio(video_path):
    """
    从视频文件中提取音频轨道并保存为MP3格式。
    """
    audio_path = os.path.splitext(video_path)[0] + ".mp3"
    command = ["ffmpeg", "-i", video_path, "-q:a", "0", "-map", "a", audio_path, "-y"]
    subprocess.run(command, check=True)
    return audio_path


global video_fps  # 定义全局变量存储帧率


@app.route("/upload", methods=["POST"])
def upload():
    global video_path, video_frames, video_fps
    video_file = request.files["video"]
    video_path = "uploads/" + video_file.filename
    video_file.save(video_path)

    # 提取视频帧
    video_frames = extract_frames(video_path)

    # 提取帧率
    cap = cv2.VideoCapture(video_path)
    video_fps = cap.get(cv2.CAP_PROP_FPS)

    cap.release()

    # 提取音频并保存
    audio_path = extract_audio(video_path)

    short_audio_path = audio_path.split("/")[-1]

    return jsonify(success=True, audioPath=short_audio_path, fps=video_fps)


@app.route("/audio/<filename>")
def audio(filename):
    return send_from_directory("uploads", filename)


@app.route("/frames", methods=["GET"])
def get_frames():
    global video_fps  # 确保使用全局变量
    return jsonify(frames=video_frames, fps=video_fps)


@app.route("/annotate", methods=["POST"])
def annotate():
    global frame_annotations
    data = request.get_json()
    frame_annotations = data

    video_name = os.path.splitext(os.path.basename(video_path))[0]
    result_path = os.path.join("result", f"{video_name}_annotations.json")

    with open(result_path, "w") as file:
        json.dump(frame_annotations, file, indent=2)

    return jsonify(success=True)


@app.route("/annotations", methods=["GET"])
def get_annotations():
    return jsonify(annotations=frame_annotations)


@app.route("/generate_subtitle", methods=["POST"])
def generate_subtitle():
    data = request.get_json()
    frame_index = data["frameIndex"]
    subtitle = handle_audio(frame_index)
    return jsonify(subtitle=subtitle)


@app.route("/delete_annotation", methods=["POST"])
def delete_annotation():
    global frame_annotations
    data = request.get_json()
    annotation_index = data.get("annotationIndex", -1)  # 使用get方法获取annotationIndex，默认为-1

    if 0 <= annotation_index < len(frame_annotations):
        del frame_annotations[annotation_index]
        return jsonify(success=True)
    else:
        return jsonify(success=False, message="Invalid annotation index")

@app.route('/save_tasks', methods=['POST'])
def save_tasks():
    tasks = request.get_json()
    # 将tasks保存到外部文件,例如tasks.json
    with open('tasks.json', 'w') as f:
        json.dump(tasks, f)
    return jsonify({'success': True})

def handle_audio(frame_index):
    # 模拟生成字幕的函数，这里只是返回一个占位符字符串
    return f"Generated subtitle for frame {frame_index}"


def extract_frames(video_path):
    frames = []
    cap = cv2.VideoCapture(video_path)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        _, buffer = cv2.imencode(".jpg", frame)
        frame_data = base64.b64encode(buffer).decode("utf-8")
        frames.append(frame_data)

    cap.release()
    return frames  # 不再返回帧率


if __name__ == "__main__":
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    if not os.path.exists("result"):
        os.makedirs("result")
    app.run(debug=True)
