## FSLDiagnotor

Codes for the interactive analysis system, FSLDiagnotor, described in our paper "Diagnosing Ensemble Few-Shot Classifiers" (TVCG accepted).

## Introduction

FSLDiagnotor is a visual analysis tool for ensemble few-shot learning. It supports users to 1) finding a subset of diverse and cooperative learners that well predict the sample collections and 2) removing low-quality shots and recommending necessary new shots to adequately represent the sample collection. A video demo is available at [here](https://repo.vicayang.cc/Diagnosing_Ensemble_Few_Shot_Classifiers/video.html).

## Quick start

Here is the scripts for setup. You can simply `bash reproduce.sh` if you are using conda, or make necessary modifications on in.

```
# download repo
git clone xxxxxx
cd xxxxxx

# config the enviroment
# I strongly suggest you creating a new environment using venv or conda, here I use conda
conda create -n fsl python=3.8
pip install -r requirements

# download data
pip install gdown
gdown https://drive.google.com/uc?id=1Ey8_4ySTAZzNd3ZYtXKlWo-F805sWS5C
tar -xvzf data.tar.gz
rm data.tar.gz

# run
python manage.py run
```

## Citation

After it is early-accessed, I will release the bib file.

## Contact

If you have any problem, feel free to open an issue or contact vicayang496@gmail.com