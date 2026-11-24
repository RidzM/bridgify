#!/usr/bin/env bash
# Download every raw input into ml/data/raw and the MediaPipe models into ml/models_src.
# Needs: curl, unzip, kaggle CLI with credentials in ~/.kaggle (or KAGGLE_* env).
set -euo pipefail
cd "$(dirname "$0")/.."
K=${KAGGLE:-kaggle}
mkdir -p models_src data/raw/{asl-hg/data,dwibon,hagrid,kdef}

for m in hand_landmarker face_landmarker; do
  curl -sSL -o "models_src/$m.task" "https://storage.googleapis.com/mediapipe-models/$m/$m/float16/latest/$m.task"
done

for f in README.md split_audit.json data/train-00000-of-00001.parquet data/test-00000-of-00001.parquet; do
  curl -sSL -o "data/raw/asl-hg/$f" "https://huggingface.co/datasets/juanjodurillo/asl-hg/resolve/main/$f"
done

$K datasets download dwibonbhargabdeka/isl-dataset-mediapipe-hand-landmarks -p data/raw/dwibon --unzip

for c in like dislike palm stop one peace fist call ok rock three four mute two_up; do
  $K datasets download kapitanov/hagrid -f "ann_test/$c.json" -p data/raw/hagrid
  [ -f "data/raw/hagrid/$c.json.zip" ] && unzip -oq "data/raw/hagrid/$c.json.zip" -d data/raw/hagrid && rm "data/raw/hagrid/$c.json.zip"
done

$K datasets download muhammadnafian/kdef-dataset -p data/raw/kdef
unzip -oq data/raw/kdef/kdef-dataset.zip '*S.JPG' '*HL.JPG' '*HR.JPG' -d data/raw/kdef
rm data/raw/kdef/kdef-dataset.zip
