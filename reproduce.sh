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