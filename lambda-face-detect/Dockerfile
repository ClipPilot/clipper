FROM public.ecr.aws/lambda/python:3.11

# Install ffmpeg and system dependencies
RUN yum update -y && \
    yum install -y \
    tar \
    xz \
    mesa-libGL \
    && yum clean all

# Install ffmpeg (static build)
RUN curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz && \
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp && \
    cp /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    cp /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    rm -rf /tmp/ffmpeg*

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to handler
CMD ["handler.handler"]
