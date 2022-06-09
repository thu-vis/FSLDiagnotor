import json
import os
import re
import uuid
import pickle
import numpy as np
import math
import threading
from flask import Blueprint, request
from flask import jsonify, send_file
from scipy.sparse import load_npz
from sklearn import manifold
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import euclidean_distances, cosine_distances
from io import BytesIO
import base64
import os.path as osp

from .dataloader import DataLoader
from .model import BasicFewShotClassifier, EnsembleClassifier, random_shot_per_class

from functools import wraps
import time

CACHE_NAME = '57_57'
def func_timer(function):
    @wraps(function)
    def function_timer(*args, **kwargs):
        print(f'[Function: {function.__name__} start...]')
        t0 = time.time()
        result = function(*args, **kwargs)
        t1 = time.time()
        print(f'[Function: {function.__name__} finished, spent time: {t1 - t0:.2f}s]')
        return result
    return function_timer

class NumpyEncoder(json.JSONEncoder):
    """ Custom encoder for numpy data types """
    def default(self, obj):
        if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                            np.int16, np.int32, np.int64, np.uint8,
                            np.uint16, np.uint32, np.uint64)):

            return int(obj)

        elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
            return float(obj)

        elif isinstance(obj, (np.complex_, np.complex64, np.complex128)):
            return {'real': obj.real, 'imag': obj.imag}

        elif isinstance(obj, (np.ndarray,)):
            return obj.tolist()

        elif isinstance(obj, (np.bool_)):
            return bool(obj)

        elif isinstance(obj, (np.void)):
            return None

        return json.JSONEncoder.default(self, obj)


data = Blueprint('data', __name__)

session = {
    'dataset': None,
}
sem = threading.Semaphore()

DATA_DIR = ''
CACHE_DIR = ''
def check_cache(name, id, type):
    filename = osp.join(CACHE_DIR, f'{id}-{name}.{type}')
    return osp.exists(filename)

def write_cache(obj, name, id, type):
    if type == 'pickle':
        with open(osp.join(CACHE_DIR, f'{id}-{name}.{type}'), 'wb') as f:
            pickle.dump(obj, f)
    elif type == 'json':
        with open(osp.join(CACHE_DIR, f'{id}-{name}.{type}'), 'w') as f:
            json.dump(obj, f, cls=NumpyEncoder)
    else:
        raise ValueError("not support type: ", type)

def read_cache(name, id, type):
    if type == 'pickle':
        with open(osp.join(CACHE_DIR, f'{id}-{name}.{type}'), 'rb') as f:
            return pickle.load(f)
    elif type == 'json':
        with open(osp.join(CACHE_DIR, f'{id}-{name}.{type}'), 'r') as f:
            return json.load(f)
    raise ValueError("not support type: ", type)


@data.route('/init', methods=['POST'])
@func_timer
def init():
    global session, DATA_DIR, CACHE_DIR
    np.random.seed(42)
    post = json.loads(request.get_data())
    if session['dataset'] != post['dataset']:
        session['dataset'] = post['dataset']
        session['data_loader'] = DataLoader(session['dataset'])
        DATA_DIR = session['data_loader'].base_dir
        CACHE_DIR = osp.join(DATA_DIR, 'cache')
    session['DR_method'] = 'TSNE'
    if 'cache' in session and 'ensemble' in session['cache']: del session['cache']['ensemble']
    return jsonify({
        'dataset': session['dataset'],
        'unique_labels': session['data_loader'].unique_labels,
        'label2name': session['data_loader'].label2name,
    })


@data.route('/get_data', methods=['POST'])
@func_timer
def get_data():
    global session
    post = json.loads(request.get_data())
    selected_labels = session['data_loader'].unique_labels
    session['seed1'], session['seed2'] = int(post['seed1']), int(post['seed2'])
    session['id'] = f"{session['seed1']}_{session['seed2']}"
    session['cache'] = dict()
    session['cache']['selected_labels'] = selected_labels
    if check_cache('ids', CACHE_NAME, 'pickle'):
        ids = read_cache('ids', CACHE_NAME, 'pickle')
    else:
        number_of_nodes_per_class = 60 if session['dataset'] == 'cifar' else 100
        ids = session['data_loader'].get_ids_by_labels(selected_labels, number_of_nodes_per_class, session['seed1'])
        write_cache(ids, 'ids', CACHE_NAME, 'pickle')
    load_data(ids)
    return jsonify({
        'ids': session['cache']['ids'],
        'images': session['cache']['images'],
        'labels': session['cache']['labels'].tolist(),
        'N': session['cache']['N'],
        'selected_labels': selected_labels,
    })

def load_data(ids):
    ensemble_feat = session['data_loader'].get_ensemble_feature(ids)
    labels = session['data_loader'].get_labels(ids)
    images = [get_encoded_img(i) for i in ids]
    session['cache']['ids'] = ids
    session['cache']['ensemble_feat'] = ensemble_feat
    session['cache']['labels'] = labels
    session['cache']['images'] = images
    session['cache']['N'] = len(labels)

@data.route('/get_scatterplot', methods=['GET'])
@func_timer
def get_scatterplot():
    global session
    if check_cache('tsne', session['id'], 'json'):
        ret = read_cache('tsne', session['id'], 'json')
    else:
        with open(f'{DATA_DIR}/extra_data/tsne.json') as f:
            data = json.load(f)
        each_pred = [clf.pred for clf in session['cache']['ensemble'].clfs]
        each_pred = [[each_pred[k][i] for k in range(len(session['cache']['ensemble'].clfs))] for i in range(len(session['cache']['labels']))]
        
        ret = {
            'x': data['x'],
            'y': data['y'],
            'all_x': data['x'],
            'all_y': data['y'],
            'all_pred': session['cache']['ensemble'].ensemble.pred,
            'all_label': session['cache']['labels'],
            'each_pred': each_pred,
        }
        write_cache(ret, 'tsne', session['id'], 'json')
    session['all_scatter_info'] = ret
    return jsonify(ret)

@data.route('/set_DR_method', methods=['POST'])
def set_DR_method():
    global session
    post = json.loads(request.get_data())
    session['DR_method'] = post['DR_method']
    ret = dict()
    if session['DR_method'] == 'TSNE':
        ret['keys'] = ['perplexity', 'learning_rate']
        ret['perplexity'] = [5, 50, 30, 1]
        ret['learning_rate'] = [10, 1000, 200, 1]
    if session['DR_method'] == 'MDS':
        ret['keys'] = []
    if session['DR_method'] == 'UMAP':
        ret['keys'] = ['n_neighbors', 'min_dist']
        ret['n_neighbors'] = [2, 200, 15, 1]
        ret['min_dist'] = [0.0, 0.99, 0.1, 0.01]
    if session['DR_method'] == 'LDA':
        ret['keys'] = []
    if session['DR_method'] == 'PCA':
        ret['keys'] = []

    return jsonify(ret)

@func_timer
@data.route('/get_image', methods=['GET'])
def get_image():
    global session
    id = int(request.args['id'])
    image_path = session['data_loader'].get_image_filename(id)
    return send_file(image_path)


@data.route('/add_model', methods=['POST'])
@func_timer
def add_model():
    global session
    global sem
    sem.acquire()
    if 'ensemble' not in session['cache']:
    #if True:
        session['add_model_cnt'] = 0
        clfs = [BasicFewShotClassifier(feat, session['cache']['labels'], session['data_loader'].model_names[i])
            for i, feat in enumerate(session['cache']['ensemble_feat'])]
        if check_cache('model', CACHE_NAME, 'pickle'):
            session['cache']['ensemble'] = read_cache('model', CACHE_NAME, 'pickle')
        else:
            if session['dataset'] == 'mnist':
                support_set_idxes = [10,33,95,98,255,290,192,268,278,382,384,459,333,491,440,495,596,392,746,684,644,639,710,717,788,820,854,856,908,959]
                session['cache']['ensemble'] = EnsembleClassifier(clfs, 3, session['seed2'], idxes=support_set_idxes)
            else:
                session['cache']['ensemble'] = EnsembleClassifier(clfs, 3, session['seed2'])
            test_baseline_on_other_data()
            test_on_other_data()
            write_cache(session['cache']['ensemble'], 'model', session['id'], 'pickle')
        if check_cache('outer', session['id'], 'json'):
            session['cache']['outer_result'] = read_cache('outer', session['id'], 'json')
        else:
            test_on_other_data()
            write_cache(session['cache']['outer_result'], 'outer', session['id'], 'json')
    else:
        session['add_model_cnt'] += 1
        post = json.loads(request.get_data())
        support_set_idxes = post['support_set_idxes']
        support_set_labels = post['support_set_labels']
        selected_baselearners = post['selected_baselearners']
        clfs_weight = post['clfs_weight']
        extra_data = post['extra_data']
        if len(extra_data) != 0:
            ids = session['cache']['ids']
            previous_n = len(ids)
            ids = ids + [x['id'] for x in extra_data]
            current_n = len(ids)
            support_set_idxes = support_set_idxes + list(range(previous_n, current_n))
            support_set_labels = support_set_labels + [x['label'] for x in extra_data]
            load_data(ids)
            clfs = [BasicFewShotClassifier(feat, session['cache']['labels'], session['data_loader'].model_names[i])
                for i, feat in enumerate(session['cache']['ensemble_feat'])]
            session['cache']['ensemble'].clfs = clfs
        session['cache']['ensemble'].update(support_set_idxes, support_set_labels, selected_baselearners, clfs_weight)
        test_on_other_data()
    info = session['cache']['ensemble'].get_info()
    ret = {
        'ensemble': info,
        'support_set_idxes': session['cache']['ensemble'].support_set_idxes,
        'support_set_labels': session['cache']['ensemble'].support_set_labels
    }
    sem.release()
    return jsonify(ret)

def test_baseline_on_other_data():
    ensemble = session['cache']['ensemble'].init_model
    print('inner', ensemble.make_prediction(session['cache']['ensemble_feat'], session['cache']['labels'])['ensemble_info'][0])
    all_feat, all_label = session['data_loader'].get_ensemble_feature(), session['data_loader'].get_labels()
    print('outer', ensemble.make_prediction(all_feat, all_label)['ensemble_info'][0])

def test_on_other_data():
    global session
    ensemble = session['cache']['ensemble'].ensemble
    idxes = session['cache']['ensemble'].selected_clf_idxes
    feat, label = session['cache']['ensemble_feat'], session['cache']['labels']
    session['cache']['inner_result'] = ensemble.make_prediction([feat[i] for i in idxes], label)['ensemble_info']
    print('inner', session['cache']['inner_result'][0])
    all_feat, all_label = session['data_loader'].get_ensemble_feature(), session['data_loader'].get_labels()
    session['cache']['outer_result'] = ensemble.make_prediction([all_feat[i] for i in idxes], all_label)['ensemble_info']
    print('outer', session['cache']['outer_result'][0])


@data.route('/get_influence', methods=['POST'])
def get_influence():
    global session
    global sem
    if 'ensemble' not in session['cache']:
        return jsonify({})
    sem.acquire()
    post = json.loads(request.get_data())
    idx, model_id = post['idx'], int(post['model_id'])
    model = session['cache']['ensemble'].ensemble if model_id == -1 else session['cache']['ensemble'].clfs[model_id]
    ret = model.get_shot_coverage_and_margin(idx)
    sem.release()
    return jsonify(ret)

@data.route('/get_all_learner_influence', methods=['POST'])
def get_all_learner_influence():
    global session
    global sem
    if 'ensemble' not in session['cache']:
        return jsonify({})
    if 'learner_influence' not in session['cache']:
        session['cache']['learner_influence'] = dict()
    sem.acquire()
    post = json.loads(request.get_data())
    ret = []
    for index in post['model_ids']:
        model_id = int(index)
        if model_id in session['cache']['learner_influence']:
            ret.append(session['cache']['learner_influence'][model_id])
        else:
            t = session['cache']['ensemble'].adjust_baselearner(model_id)
            ret.append(t)
            session['cache']['learner_influence'][model_id] = t
    sem.release()
    return jsonify(ret)

@data.route('/get_learner_influence', methods=['POST'])
def get_learner_influence():
    global session
    global sem
    if 'ensemble' not in session['cache']:
        return jsonify({})
    if 'learner_influence' not in session['cache']:
        session['cache']['learner_influence'] = dict()
    sem.acquire()
    post = json.loads(request.get_data())
    model_id = int(post['model_id'])
    if model_id in session['cache']['learner_influence']:
        ret = session['cache']['learner_influence'][model_id]
    else:
        ret = session['cache']['ensemble'].adjust_baselearner(model_id)
        session['cache']['learner_influence'][model_id] = ret
    sem.release()
    return jsonify(ret)


def serve_pil_image(pil_img):
    img_io = BytesIO()
    pil_img.save(img_io, 'JPEG', quality=70)
    img_io.seek(0)
    return send_file(img_io, mimetype='image/jpeg')


@data.route('/get_explain_image', methods=['GET'])
def get_explain_image():
    global session
    id = int(request.args['id'])
    hash = request.args['hash']
    if hash not in session['cache']['explainer']:
        return jsonify({})
    key = f'{id}-{hash}'
    explainer = session['cache']['explainer'][hash]
    image_path = session['data_loader'].get_image_filename(id)
    result = explainer.visualize(image_path, attr,
            clip_above_percentile=99,
            clip_below_percentile=55,
            overlay=True,
            morphological_cleanup=True,
            outlines=True)
    return serve_pil_image(result)

@data.route('/get_recommend_shot', methods=['GET'])
@func_timer
def recommend_shot():
    global session
    if session['dataset'] == 'mnist':
        n = 0 if 'firsttime' not in session else 5
        session['firsttime'] = True
        add, rm, final = session['cache']['ensemble'].recommend_shot_DS3(n)
    else:
        add, rm, final = session['cache']['ensemble'].recommend_shot_DS3(10)
    ret = {'add': add, 'rm': rm}

    return jsonify(ret)

@data.route('/get_recommend_shot_from_selected', methods=['POST'])
@func_timer
def recommend_shot_from_selected():
    global session
    post = json.loads(request.get_data())
    idxes = post['idxes']
    if session['dataset'] == 'mnist':
        ret = session['cache']['ensemble'].recommend_shot_from_selected(idxes, 1)
    else:
        ret = session['cache']['ensemble'].recommend_shot_from_selected(idxes)
    return jsonify({ 'idx': ret })

@data.route('/get_recommend_learner', methods=['GET'])
@func_timer
def recommend_learner():
    global session
    ensemble = session['cache']['ensemble']
    print(ensemble.selected_clf_idxes)
    ret = ensemble.recommend_learner()
    print(ret)
    ensemble.update(ensemble.support_set_idxes, ensemble.support_set_labels, ret, ensemble.clfs_weight)
    test_on_other_data()
    return jsonify({ 'selected_clf_idxes': ret })

@data.route('/get_similar_data', methods=['POST'])
@func_timer
def get_similar_data():
    global session
    post = json.loads(request.get_data())
    ids = post['ids']
    ret = search_similar_data(ids)
    return jsonify({ 'data': ret })

def search_similar_data(ids):
    global session
    selected_clf_idxes = session['cache']['ensemble'].selected_clf_idxes
    mean_feat = session['data_loader'].get_ensemble_feature(ids)
    mean_feat = [mean_feat[i].mean(axis=0).reshape(1,-1) for i in selected_clf_idxes]
    all_feat = session['data_loader'].get_ensemble_feature()
    all_feat = [all_feat[i] for i in selected_clf_idxes]
    dists = np.zeros((all_feat[0].shape[0]))
    for x, y in zip(mean_feat, all_feat):
        dists += np.sqrt(((y-x)**2).sum(axis=1))
    new_ids = dists.argsort()
    existing_ids = set(session['cache']['ids'])
    new_ids = [i for i in new_ids if i not in existing_ids][:100]
    sample_feats = [feat[new_ids, :] for feat in all_feat]
    sample_dists = [cosine_distances(feat, feat) for feat in sample_feats]
    dist = np.array(sample_dists).mean(axis=0)
    selection = EnsembleClassifier.recommend_shot_from_dist_margin(dist, c=2)
    new_ids = [new_ids[i] for i in selection]

    all_label = session['data_loader'].get_labels()
    all_pred, all_probs = session['cache']['outer_result'][1], session['cache']['outer_result'][5]
    ret = [ {
        'idx': -1-i,
        'id': id,
        'image': get_encoded_img(id),
        'label': -1,
        'gt_label': all_label[id],
        'pred': all_pred[id],
        'probs': all_probs[id],
    } for i, id in enumerate(new_ids)]
    return ret

@data.route('/save_cache', methods=['GET'])
def save_cache():
    name = request.args.get("name")
    write_cache(session['cache']['ensemble'], 'model', name, 'pickle')
    write_cache(session['cache']['ids'], 'ids', name, 'pickle')
    return 'ok'

def get_encoded_img(id):
    image_path = session['data_loader'].get_image_filename(id)        
    with open(image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read())
    return encoded_string.decode('ascii')

def print_detail_info(pred, gt):
    pred = np.array(pred)
    gt = np.array(gt)
    print((pred==gt).sum())
    for k in range(20):
        print(session['data_loader'].label2name[str(k)], (pred==k).sum(), ((pred==k)&(gt==k)).sum(), end=',')


@data.route('/adjust_weight', methods=['POST'])
def adjust_weight():
    global session
    global sem
    if 'ensemble' not in session['cache']:
        return jsonify({})
    sem.acquire()
    post = json.loads(request.get_data())
    learner_idx, sample_idxes, increase = post['learner_idx'], post['sample_idxes'], post['increase']
    weight = session['cache']['ensemble'].search_weight(learner_idx, sample_idxes, increase)
    sem.release()
    return jsonify({'weight': weight})


@data.route('/zoomin', methods=['POST'])
def zoomin():
    global session
    global sem
    sem.acquire()
    post = json.loads(request.get_data())
    ids = post['ids']
    ensemble = session['cache']['ensemble'].ensemble
    images = [get_encoded_img(i) for i in ids]
    all_feat, all_label = session['data_loader'].get_ensemble_feature(ids), session['data_loader'].get_labels(ids)
    idxes = session['cache']['ensemble'].selected_clf_idxes
    result = ensemble.make_prediction([all_feat[i] for i in idxes], all_label)
    ensemble_info = result['ensemble_info']
    learner_margin = [x[-1] for x in result['learner_info']]
    ensemble_info = {
        'pred': ensemble_info[1],
        'uncertain_pred': ensemble_info[-1],
        'margin': ensemble_info[-2],
        'probs': ensemble_info[-3],
        'learner_margin': learner_margin,
    }
    sem.release()
    return {'images': images, 'ensemble_info': ensemble_info}