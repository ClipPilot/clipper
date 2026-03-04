FROM public.ecr.aws/lambda/python:3.12

# Install ffmpeg and system dependencies (AL2023 uses dnf)
RUN dnf install -y \
    tar \
    xz \
    && dnf clean all

# Install ffmpeg (static build from GitHub)
RUN curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz -o /tmp/ffmpeg.tar.xz && \
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp && \
    cp /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg /usr/local/bin/ && \
    cp /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffprobe /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    rm -rf /tmp/ffmpeg*

# Copy requirements and install Python dependencies (CPU-only PyTorch)
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple/ \
    -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy model download script and bake model into image
COPY download_model.py ${LAMBDA_TASK_ROOT}/
RUN python ${LAMBDA_TASK_ROOT}/download_model.py

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to handler
CMD ["handler.handler"]
