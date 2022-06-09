import json
import pickle
from sklearn.metrics.pairwise import euclidean_distances, cosine_distances
import os
import os.path as osp
import numpy as np
import glob
import random

def to_name(path):
    if 'decay' in path:
        infos = path.split('/')[-2].split('_')
        data = infos[1]
        trial = infos[-1]
        return f'{data}-{trial}'
    else:
        path = path.split('/')[-2]
        if 'film' in path:
            return path.split('-')[0]
        return path[path.find('tiered'):] if 'tiered' in path else path[path.find('mini'):]
    

class DataLoader:

    DATA_DIR = "data"
    def __init__(self, dataset):
        self.dataset = dataset
        self.base_dir = osp.join(DataLoader.DATA_DIR, dataset)
        self.img_dir = osp.join(self.base_dir, "img")
        self.labels = np.load(osp.join(self.base_dir, "label",  f'{dataset}.npy'))
        self.unique_labels = np.unique(self.labels).tolist()
        with open(osp.join(self.base_dir, "labelname",  f'{dataset}.json')) as f:
            self.label2name = json.load(f)
        self.id2filename = np.load(osp.join(self.base_dir, "fname",  f'{dataset}.npy'))
        self.feat_paths = sorted(list(glob.glob(osp.join(self.base_dir, "feat", '*', f'{dataset}.npy'))))
        self.model_names = [to_name(path) for path in self.feat_paths]
        self.ensemble_feat = [np.load(feat_path) for feat_path in self.feat_paths]

    def load_data(self):
        pass

    def get_image_filename(self, id):
        return osp.abspath(f'{self.img_dir}/{self.id2filename[id]}')

    def get_ids_by_labels(self, labels, cnt=50, seed=3):
        rnd = np.random.RandomState(seed)
        idxes = []
        for ll in labels:
            idx = [i for i, l in enumerate(self.labels) if l == ll]
            idx = rnd.choice(idx, cnt, replace=False)
            idxes += list(idx)
        return sorted([int(i) for i in idxes])


    def get_distance_matrix(self, ids=None):
        dist = np.mean([euclidean_distances(feat[ids], feat[ids]) for feat in self.ensemble_feat], axis=0)
        return dist

    def get_ensemble_feature(self, ids=None):
        return [feat if ids is None else feat[ids, :] for feat in self.ensemble_feat]

    def get_labels(self, ids=None):
        return self.labels if ids is None else self.labels[ids]
