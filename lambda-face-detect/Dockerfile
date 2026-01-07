FROM public.ecr.aws/lambda/python:3.11

# Install ffmpeg and system dependencies
RUN yum update -y && \
    yum install -y \
    tar \
    xz \
    mesa-libGL \
    && yum clean all

# Install ffmpeg (static build from GitHub - more reliable than johnvansickle.com)
RUN curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz -o /tmp/ffmpeg.tar.xz && \
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp && \
    cp /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg /usr/local/bin/ && \
    cp /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffprobe /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    rm -rf /tmp/ffmpeg*

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Download face detection models at build time (faster cold starts)
RUN mkdir -p ${LAMBDA_TASK_ROOT}/models && \
    curl -L "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt" \
        -o ${LAMBDA_TASK_ROOT}/models/deploy.prototxt && \
    curl -L "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel" \
        -o ${LAMBDA_TASK_ROOT}/models/res10_300x300_ssd_iter_140000.caffemodel

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to handler
CMD ["handler.handler"]
