## FSLDiagnotor

Codes for the interactive analysis system, FSLDiagnotor, described in our paper "Diagnosing Ensemble Few-Shot Classifiers" (TVCG accepted).

## Introduction

FSLDiagnotor is a visual analysis tool for ensemble few-shot learning. It supports users to 1) find a subset of diverse and cooperative learners that well predict the sample collections and 2) remove low-quality shots and recommending necessary new shots to adequately represent the sample collection. A video demo is available at [here](https://repo.vicayang.cc/Diagnosing_Ensemble_Few_Shot_Classifiers/video.html).

## Quick start

Here is the scripts for setup. You can simply `bash reproduce.sh` if you are using conda, or make necessary modifications on it.

```{bash}
# download repo
# git clone https://github.com/VicaYang/FSLDiagnotor.git
# cd FSLDiagnotor

# config the enviroment
# I strongly suggest you creating a new environment using venv or conda, here I use conda
# You can install miniconda, which is quite lighter than anaconda.
yes | conda create -n fsl python=3.8
conda activate fsl
pip install -r requirements.txt

# download data
pip install gdown
gdown https://drive.google.com/uc?id=1Ey8_4ySTAZzNd3ZYtXKlWo-F805sWS5C
tar -xvzf data.tar.gz
rm data.tar.gz

# run
python manage.py run
```

## Reproduce the teaser

You should see the interface of FSLDiagnotor, which is quite similar to the teaser (despite some small modification such as annotations). The visual effect may change due to the difference resolution of your browser. The figure in our paper is render using a resolution of 1200x800. Take chrome as an example, you can enter the dev model using `Ctrl+Shift+I`, and then resize the browser. You should see the current resolution of your brower on the top-right corner during you adjustment.

## Citation

After it is early-accessed, I will release the bib file.

## Contact

If you have any problem, feel free to open an issue or contact vicayang496@gmail.com