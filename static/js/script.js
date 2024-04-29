const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const annotationTypeSelect = document.getElementById('annotation-type');
const saveButton = document.getElementById('save-button');
const fileInput = document.getElementById('file-input');
const annotationInfo = document.getElementById('annotation-info');
const playPauseButton = document.getElementById('play-pause-button');
const frameInfo = document.getElementById('frame-info');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const subtitleInput = document.getElementById('subtitle-input');
const generateButton = document.getElementById('generate-button');
const videoAudio = document.getElementById('video-audio');

const deleteButton = document.getElementById('delete-button');
let selectedAnnotationIndex = -1;

let frames = [];
let currentFrameIndex = 0;
let isPlaying = false;
let animationId;
const annotations = [];
let videoFps; // 全局变量来存储帧率

function updateAnnotationInfo(annotation, index) {
    const infoElement = document.createElement('div');
    infoElement.textContent = `Type: ${annotation.annotationType}, Frame: ${annotation.frameIndex + 1}, Data: ${JSON.stringify(annotation.annotationData)}`;
    infoElement.addEventListener('click', function () {
        selectedAnnotationIndex = index;
    });
    annotationInfo.appendChild(infoElement);
    annotationInfo.scrollTop = annotationInfo.scrollHeight;
}

deleteButton.addEventListener('click', function () {
    if (selectedAnnotationIndex !== -1) {
        console.log(`Attempting to delete annotation at index: ${selectedAnnotationIndex}`);

        fetch('/delete_annotation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ annotationIndex: selectedAnnotationIndex })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    annotations.splice(selectedAnnotationIndex, 1); // 删除前端数组中的注释
                    selectedAnnotationIndex = -1; // 重置已选注释索引
                    refreshAnnotations(); // 刷新注释显示
                    drawAnnotations(currentFrameIndex); // 假设这个函数用于重绘当前帧和帧上的注释
                } else {
                    console.error('Failed to delete annotation:', data.message);
                }
            })
            .catch(error => console.error('Error in delete annotation request:', error));
    } else {
        console.warn('No annotation selected for deletion.');
    }
});

let annotationTypes = [];
let shortcutLabels = [];

// 加载标注种类和快捷键
function loadAnnotationTypes() {
    fetch('/annotation-types')
        .then(response => response.json())
        .then(data => {
            annotationTypes = data.annotationTypes;
            // 查找快捷键类型并保存其标签
            const shortcutType = annotationTypes.find(type => type.type === 'shortcut');
            if (shortcutType) {
                shortcutLabels = shortcutType.labels;
            }
            updateAnnotationTypeSelect();
        })
        .catch(error => console.error('Error loading annotation types:', error));
}

// 更新标注类型选择菜单
function updateAnnotationTypeSelect() {
    const annotationTypeSelect = document.getElementById('annotation-type');
    annotationTypeSelect.innerHTML = ''; // 清空当前选项
    annotationTypes.forEach(type => {
        if (type.type !== 'shortcut') { // 快捷键不在这个下拉菜单中显示
            const option = document.createElement('option');
            option.value = type.type;
            option.textContent = type.type;
            annotationTypeSelect.appendChild(option);
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    fetchLabelsAndUpdateUI();

    // Event listener for annotation type change
    document.getElementById('annotation-type').addEventListener('change', function () {
        const selectedAnnotationType = this.value;
        updateLabelOptions(selectedAnnotationType);
    });
});

// Fetch labels from server and update UI accordingly
function fetchLabelsAndUpdateUI() {
    fetch('/labels')
        .then(response => response.json())
        .then(data => {
            window.annotationLabels = data; // Store the labels globally
            const initialAnnotationType = document.getElementById('annotation-type').value;
            updateLabelOptions(initialAnnotationType);
        });
}

// Update label options based on selected annotation type
function updateLabelOptions(annotationType) {
    const labelSelect = document.getElementById('annotation-label');
    labelSelect.innerHTML = ''; // Clear existing options

    const labels = window.annotationLabels[annotationType] || [];
    labels.forEach(label => {
        const option = document.createElement('option');
        option.value = label;
        option.textContent = label;
        labelSelect.appendChild(option);
    });
}

function refreshAnnotations() {
    annotationInfo.innerHTML = ''; // 清空注释信息显示区域
    annotations.forEach((annotation, index) => {
        const infoElement = document.createElement('div');
        infoElement.textContent = `Type: ${annotation.annotationType}, Frame: ${annotation.frameIndex + 1}, Data: ${JSON.stringify(annotation.annotationData)}`;
        annotationInfo.appendChild(infoElement);
    });
}

function refreshAnnotations() {
    annotationInfo.innerHTML = ''; // 清空注释信息显示
    annotations.forEach((annotation, index) => {
        updateAnnotationInfo(annotation, index); // 重新添加所有注释到显示中
    });
}

document.getElementById('frame-slider').addEventListener('input', function (event) {
    currentFrameIndex = parseInt(event.target.value, 10);
    displayFrame(currentFrameIndex);
    adjustAudioToFrame(currentFrameIndex);
});

document.addEventListener('keydown', function (event) {
    switch (event.key) {
        case 'ArrowLeft':  // Assuming you want to use the arrow keys
            document.getElementById('prev-button').click();
            break;
        case 'Space':  // Use the space bar to play/pause
            event.preventDefault();  // Prevent the default action of the space bar (scrolling)
            document.getElementById('play-pause-button').click();
            break;
        case 'ArrowRight':
            document.getElementById('next-button').click();
            break;
    }
});

fileInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('video', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                getFrames();
                videoFps = data.fps; // 保存帧率信息
                const videoAudio = document.getElementById('video-audio');
                const audioUrl = '/audio/' + data.audioPath;
                videoAudio.src = audioUrl;
            }
        });
});

videoAudio.addEventListener('loadeddata', function () {
    // Check if enough of the media has loaded to play
    if (videoAudio.readyState >= 2) {
        // Removed the auto-play behavior to prevent audio from starting automatically
        // videoAudio.play().catch(e => console.error(e));
    }
});

function getFrames() {
    fetch('/frames')
        .then(response => response.json())
        .then(data => {
            frames = data.frames;
            videoFps = data.fps; // 保存帧率信息
            currentFrameIndex = 0;
            displayFrame(currentFrameIndex);
        });
}

function adjustAudioToFrame(frameIndex) {
    const videoAudio = document.getElementById('video-audio');
    videoAudio.currentTime = frameIndex / videoFps; // 使用实际的视频帧率
}

function displayFrame(frameIndex) {
    const img = new Image();
    img.onload = function () {
        const containerWidth = canvas.parentElement.clientWidth;
        const containerHeight = canvas.parentElement.clientHeight;
        const aspectRatio = img.width / img.height;

        let canvasWidth = containerWidth;
        let canvasHeight = containerHeight;

        if (containerWidth / aspectRatio < containerHeight) {
            canvasHeight = containerWidth / aspectRatio;
        } else {
            canvasWidth = containerHeight * aspectRatio;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        context.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        drawAnnotations();
    };
    img.src = 'data:image/jpeg;base64,' + frames[frameIndex];
    frameInfo.textContent = `Frame: ${frameIndex + 1}/${frames.length}`;
    updateSlider(); // Make sure to update slider every time the frame changes
    frameInfo.textContent = `Frame: ${frameIndex + 1}/${frames.length}`;
}

// Update slider max and value
function updateSlider() {
    const slider = document.getElementById('frame-slider');
    slider.max = frames.length - 1;
    slider.value = currentFrameIndex;
}

// Slider event listener
document.getElementById('frame-slider').addEventListener('input', function (event) {
    currentFrameIndex = parseInt(event.target.value, 10);
    displayFrame(currentFrameIndex);
    adjustAudioToFrame(currentFrameIndex);
});

let isDragging = false;
let boundingBoxStartPoint = null;

canvas.addEventListener('mousedown', function (event) {
    if (annotationTypeSelect.value === 'boundingBox') {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        boundingBoxStartPoint = { x, y };
    }
});

canvas.addEventListener('mousemove', function (event) {
    if (isDragging && annotationTypeSelect.value === 'boundingBox') {
        const rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        const img = new Image();
        img.onload = function () {
            const aspectRatio = img.width / img.height;
            let canvasWidth = canvas.width;
            let canvasHeight = canvas.height;

            let imageWidth, imageHeight, imageOffsetX, imageOffsetY;

            if (canvas.width / aspectRatio < canvas.height) {
                imageHeight = canvas.width / aspectRatio;
                imageWidth = canvas.width;
            } else {
                imageWidth = canvas.height * aspectRatio;
                imageHeight = canvas.height;
            }

            imageOffsetX = (canvas.parentElement.clientWidth - imageWidth) / 2;
            imageOffsetY = (canvas.parentElement.clientHeight - imageHeight) / 2;

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, imageOffsetX, imageOffsetY, imageWidth, imageHeight);
            drawAnnotations();

            const startX = boundingBoxStartPoint.x - imageOffsetX;
            const startY = boundingBoxStartPoint.y - imageOffsetY;
            x -= imageOffsetX;
            y -= imageOffsetY;

            context.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            context.strokeRect(startX, startY, x - startX, y - startY);
        };
        img.src = 'data:image/jpeg;base64,' + frames[currentFrameIndex];
    }
});

canvas.addEventListener('click', function (event) {
    const rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;

    const img = new Image();
    img.onload = function () {
        const aspectRatio = img.width / img.height;
        let canvasWidth = canvas.width;
        let canvasHeight = canvas.height;

        let imageWidth, imageHeight, imageOffsetX, imageOffsetY;

        if (canvas.width / aspectRatio < canvas.height) {
            imageHeight = canvas.width / aspectRatio;
            imageWidth = canvas.width;
        } else {
            imageWidth = canvas.height * aspectRatio;
            imageHeight = canvas.height;
        }

        imageOffsetX = (canvas.parentElement.clientWidth - imageWidth) / 2;
        imageOffsetY = (canvas.parentElement.clientHeight - imageHeight) / 2;

        x -= imageOffsetX;
        y -= imageOffsetY;

        if (x >= 0 && x <= imageWidth && y >= 0 && y <= imageHeight) {
            const relativeX = x / imageWidth;
            const relativeY = y / imageHeight;

            const annotationType = annotationTypeSelect.value;
            const selectedLabel = document.getElementById('annotation-label').value;

            let annotationData;

            if (annotationType === 'point') {
                annotationData = {
                    relativeX: relativeX,
                    relativeY: relativeY,
                    label: selectedLabel
                };
            } else if (annotationType === 'shortcut') {
                annotationData = {
                    label: selectedLabel
                };
            } else if (annotationType === 'boundingBox') {
                if (!boundingBoxStartPoint) {
                    boundingBoxStartPoint = {
                        relativeX: relativeX,
                        relativeY: relativeY
                    };
                } else {
                    const boundingBoxEndPoint = {
                        relativeX: relativeX,
                        relativeY: relativeY
                    };
                    annotationData = {
                        relativeStartX: boundingBoxStartPoint.relativeX,
                        relativeStartY: boundingBoxStartPoint.relativeY,
                        relativeEndX: boundingBoxEndPoint.relativeX,
                        relativeEndY: boundingBoxEndPoint.relativeY,
                        label: selectedLabel
                    };
                    boundingBoxStartPoint = null;
                }
            } else if (annotationType === 'text') {
                const textContent = prompt('请输入文本标注内容:');
                if (textContent) {
                    annotationData = {
                        text: textContent
                    };
                }
            }

            if (annotationData) {
                const annotation = {
                    frameIndex: currentFrameIndex,
                    annotationType: annotationType,
                    annotationData: annotationData
                };

                annotations.push(annotation);
                drawAnnotations();
                updateAnnotationInfo(annotation);
            }
        }
    };
    img.src = 'data:image/jpeg;base64,' + frames[currentFrameIndex];
});

function drawAnnotations() {
    const img = new Image();
    img.onload = function () {
        const aspectRatio = img.width / img.height;
        const canvasAspectRatio = canvas.width / canvas.height;

        let imageWidth, imageHeight, imageOffsetX, imageOffsetY;
        if (aspectRatio > canvasAspectRatio) {
            imageWidth = canvas.width;
            imageHeight = canvas.width / aspectRatio;
            imageOffsetX = 0;
            imageOffsetY = (canvas.height - imageHeight) / 2;
        } else {
            imageWidth = canvas.height * aspectRatio;
            imageHeight = canvas.height;
            imageOffsetX = (canvas.width - imageWidth) / 2;
            imageOffsetY = 0;
        }

        context.drawImage(img, imageOffsetX, imageOffsetY, imageWidth, imageHeight);

        annotations.forEach(function (annotation) {
            if (annotation.frameIndex === currentFrameIndex) {
                if (annotation.annotationType === 'point') {
                    const x = annotation.annotationData.relativeX * imageWidth + imageOffsetX;
                    const y = annotation.annotationData.relativeY * imageHeight + imageOffsetY;

                    context.beginPath();
                    context.arc(x, y, 5, 0, 2 * Math.PI);
                    context.fillStyle = 'rgba(255, 0, 0, 0.7)';
                    context.fill();
                } else if (annotation.annotationType === 'boundingBox') {
                    const x1 = annotation.annotationData.relativeStartX * imageWidth + imageOffsetX;
                    const y1 = annotation.annotationData.relativeStartY * imageHeight + imageOffsetY;
                    const x2 = annotation.annotationData.relativeEndX * imageWidth + imageOffsetX;
                    const y2 = annotation.annotationData.relativeEndY * imageHeight + imageOffsetY;

                    context.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
                } else if (annotation.annotationType === 'text') {
                    const x = annotation.annotationData.relativeX * imageWidth + imageOffsetX;
                    const y = annotation.annotationData.relativeY * imageHeight + imageOffsetY;

                    context.font = '16px sans-serif';
                    context.fillStyle = 'rgba(255, 0, 0, 0.7)';
                    context.fillText(annotation.annotationData.text, x, y);
                }
            }
        });
    };
    img.src = 'data:image/jpeg;base64,' + frames[currentFrameIndex];
}

canvas.addEventListener('mouseup', function (event) {
    if (isDragging && annotationTypeSelect.value === 'boundingBox') {
        isDragging = false;
        const rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        const img = new Image();
        img.onload = function () {
            const aspectRatio = img.width / img.height;
            let canvasWidth = canvas.width;
            let canvasHeight = canvas.height;

            let imageWidth, imageHeight, imageOffsetX, imageOffsetY;

            if (canvas.width / aspectRatio < canvas.height) {
                imageHeight = canvas.width / aspectRatio;
                imageWidth = canvas.width;
            } else {
                imageWidth = canvas.height * aspectRatio;
                imageHeight = canvas.height;
            }

            imageOffsetX = (canvas.parentElement.clientWidth - imageWidth) / 2;
            imageOffsetY = (canvas.parentElement.clientHeight - imageHeight) / 2;

            const startX = boundingBoxStartPoint.x - imageOffsetX;
            const startY = boundingBoxStartPoint.y - imageOffsetY;
            x -= imageOffsetX;
            y -= imageOffsetY;

            const selectedLabel = document.getElementById('annotation-label').value;

            const relativeStartX = startX / imageWidth;
            const relativeStartY = startY / imageHeight;
            const relativeEndX = x / imageWidth;
            const relativeEndY = y / imageHeight;

            const annotationData = {
                relativeStartX: relativeStartX,
                relativeStartY: relativeStartY,
                relativeEndX: relativeEndX,
                relativeEndY: relativeEndY,
                label: selectedLabel
            };

            const annotation = {
                frameIndex: currentFrameIndex,
                annotationType: 'boundingBox',
                annotationData: annotationData
            };

            annotations.push(annotation);
            drawAnnotations();
            updateAnnotationInfo(annotation);
            boundingBoxStartPoint = null;
        };
        img.src = 'data:image/jpeg;base64,' + frames[currentFrameIndex];
    }
});

let lastFrameTime = Date.now(); // 记录上一帧的时间

function playFrames() {
    // 计算当前时间与上一次调用playFrames的时间差
    const now = Date.now();
    const elapsed = now - lastFrameTime;
    const frameDelay = 1000 / videoFps; // 一帧所需的毫秒数

    // 如果经过的时间大于或等于应当显示下一帧的时间
    if (elapsed >= frameDelay) {
        // 更新上一帧的时间
        lastFrameTime = now - (elapsed % frameDelay);
        displayFrame(currentFrameIndex);
        currentFrameIndex++;
        if (currentFrameIndex >= frames.length) {
            currentFrameIndex = 0;
            isPlaying = false;
            playPauseButton.textContent = 'Play';
            videoAudio.pause();
            videoAudio.currentTime = 0;
            return; // 这里结束函数，不再请求新的帧
        }
    }

    if (isPlaying) {
        // 继续请求新的帧
        animationId = requestAnimationFrame(playFrames);
    } else {
        playPauseButton.textContent = 'Play';
        videoAudio.pause();
        videoAudio.currentTime = 0;
    }
}

function updateAnnotationInfo() {
    annotationInfo.innerHTML = ''; // Clear existing annotations
    annotations.forEach((annotation, index) => {
        const infoElement = document.createElement('div');
        infoElement.textContent = `Type: ${annotation.annotationType}, Frame: ${annotation.frameIndex + 1}, Data: ${JSON.stringify(annotation.annotationData)}`;
        infoElement.classList.add('annotation-item');
        // Add click listener for selection
        infoElement.addEventListener('click', () => {
            const previouslySelected = document.querySelector('.annotation-item.selected');
            if (previouslySelected) {
                previouslySelected.classList.remove('selected');
            }
            infoElement.classList.add('selected');
            selectedAnnotationIndex = index;
        });
        annotationInfo.appendChild(infoElement);
    });
}


saveButton.addEventListener('click', function () {
    fetch('/annotate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(annotations)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Annotations saved successfully');
            }
        });
});

playPauseButton.addEventListener('click', function () {
    const videoAudio = document.getElementById('video-audio');
    if (isPlaying) {
        cancelAnimationFrame(animationId);
        isPlaying = false;
        playPauseButton.textContent = 'Play';
        videoAudio.pause(); // 暂停音频
    } else {
        isPlaying = true;
        playPauseButton.textContent = 'Pause';
        playFrames(); // 继续播放视频帧
        videoAudio.play().catch(e => console.error(e)); // Only start playing when play button is clicked
    }
});

prevButton.addEventListener('click', function () {
    if (currentFrameIndex > 0) {
        currentFrameIndex--;
        displayFrame(currentFrameIndex); // 显示上一帧
        adjustAudioToFrame(currentFrameIndex); // 调整音频位置
    }
});

nextButton.addEventListener('click', function () {
    if (currentFrameIndex < frames.length - 1) {
        currentFrameIndex++;
        displayFrame(currentFrameIndex); // 显示下一帧
        adjustAudioToFrame(currentFrameIndex); // 调整音频位置
    }
});

prevButton.addEventListener('click', function () {
    if (currentFrameIndex > 0) {
        currentFrameIndex--;
        displayFrame(currentFrameIndex);
    }
});

nextButton.addEventListener('click', function () {
    if (currentFrameIndex < frames.length - 1) {
        currentFrameIndex++;
        displayFrame(currentFrameIndex);
    }
});

generateButton.addEventListener('click', function () {
    fetch('/generate_subtitle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ frameIndex: currentFrameIndex })
    })
        .then(response => response.json())
        .then(data => {
            subtitleInput.value = data.subtitle;
        });
});