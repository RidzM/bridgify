FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN echo "deb http://deb.debian.org/debian trixie-backports main" > /etc/apt/sources.list.d/backports.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
 && (apt-get install -y --no-install-recommends -t trixie-backports python3-louis liblouis-data \
     || apt-get install -y --no-install-recommends python3-louis liblouis-data) \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN python3 -m venv --system-site-packages /venv \
 && /venv/bin/pip install -r requirements.txt \
 && /venv/bin/pip install --no-deps gtts==2.5.4 \
 && /venv/bin/python -m spacy download en_core_web_sm
COPY bridgify ./bridgify
COPY tests ./tests
COPY gunicorn.conf.py .
RUN useradd -r -u 10001 app && mkdir -p /tmp/bridgify && chown -R app /tmp/bridgify
USER app
EXPOSE 8000
CMD ["/venv/bin/gunicorn", "-c", "gunicorn.conf.py", "bridgify:create_app()"]
