# download repo
# git clone https://github.com/VicaYang/FSLDiagnotor.git
# cd FSLDiagnotor

# config the enviroment
# I strongly suggest you creating a new environment using venv or conda, here I use conda
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