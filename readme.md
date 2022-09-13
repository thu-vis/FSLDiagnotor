## FSLDiagnotor

Codes for the interactive analysis system, FSLDiagnotor, described in our paper "Diagnosing Ensemble Few-Shot Classifiers" (TVCG accepted).

## Introduction

FSLDiagnotor is a visual analysis tool for ensemble few-shot learning. It supports users to 1) find a subset of diverse and cooperative learners that well predict the sample collections and 2) remove low-quality shots and recommend necessary new shots to adequately represent the sample collection. A video demo is available at [here](https://repo.vicayang.cc/Diagnosing_Ensemble_Few_Shot_Classifiers/video.html).

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

You should see the interface of FSLDiagnotor after running `python manage.py run`, which is quite similar to the teaser (despite some minor modifications such as annotations). The visual effect may change due to the different resolutions of your browser. The figure in our paper is rendered using a resolution of 1200x800. Take chrome as an example. You can enter the dev model using `Ctrl+Shift+I` and then resize the browser. You should see the current resolution of your browser in the top-right corner during your adjustment.

## Citation

```
@article{yang2022diagnosing,
    year = {2022},
    volume={28},
    number={9},
    pages = {3292--3306},
    author = {Weikai Yang and Xi Ye and Xingxing Zhang and Lanxi Xiao and Jiazhi Xia and Zhongyuan Wang and Jun Zhu and Hanspeter Pfister and Shixia Liu},
    title = {Diagnosing Ensemble Few-Shot Classifiers},
    journal = {{IEEE} Transactions on Visualization and Computer Graphics},
    publisher = {Institute of Electrical and Electronics Engineers ({IEEE})},
    doi={10.1109/TVCG.2022.3182488},
    url={https://doi.org/10.1109/TVCG.2022.3182488},
  }
```

## Contact

If you have any problem, feel free to open an issue or contact vicayang496@gmail.com