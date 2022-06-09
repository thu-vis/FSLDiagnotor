from sklearn.metrics.pairwise import euclidean_distances, cosine_distances
from sklearn.cluster import AgglomerativeClustering
from scipy.special import softmax, expit
from scipy.stats import entropy
import numpy as np
from scipy import stats
import hashlib
import json
from sklearn.metrics import confusion_matrix
from .DS3 import DS3

def random_shot_per_class(label, n_shot, seed):
    rnd = np.random.RandomState(seed)
    unique_label = np.unique(label)
    shots = []
    idx = np.arange(len(label))
    for l in unique_label:
        shots += list(rnd.choice(idx[label == l], n_shot, replace=False))
    return sorted(shots)

class BasicFewShotClassifier:

    SELECTED_TYPE = 'mat_'
    MARGIN_THRES = 0.5
    ALL_TYPES = [SELECTED_TYPE]
    @staticmethod
    def _get_coverage(probs, n_class):
        return 1 - entropy(probs.T) / np.log(n_class)

    @staticmethod
    def _get_margin(probs):
        ret = np.zeros(len(probs))
        for i, row in enumerate(probs):
            tmp = row[row.argsort()[-2:]]
            ret[i] = tmp[1] - tmp[0]
        return ret

    @staticmethod
    def _get_score(probs, min_one):
        return probs[range(len(min_one)), min_one]

    @staticmethod
    def distance_predict_combine(feat, labels, unique_labels, support_set_idxes, support_set_labels, temp):
        class_feat = np.zeros((len(unique_labels), feat.shape[1]))
        for i, label in enumerate(unique_labels):
            idx = np.asarray(support_set_idxes)[support_set_labels == label]
            class_feat[i, ] = feat[idx, ].mean(axis=0)
        class_dist = euclidean_distances(feat, class_feat) ** 2 / temp
        probs = softmax(-class_dist, axis=1)
        min_one = np.argmax(probs, axis=1)
        return unique_labels[min_one], class_feat, class_dist, probs

    @staticmethod
    def distance_predict_individual(feat, labels, unique_labels, support_set_idxes, support_set_labels, temp):
        class_feat = feat[support_set_idxes]
        shot_dist = euclidean_distances(feat, class_feat) ** 2 / temp
        ord_labels = np.array([list(unique_labels).index(label) for label in support_set_labels])
        onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
        onehot_labels = onehot_labels / onehot_labels.sum(axis=0)
        class_dist = np.matmul(shot_dist, onehot_labels)
        probs = softmax(-class_dist, axis=1)
        min_one = np.argmax(probs, axis=1)
        return unique_labels[min_one], class_feat, shot_dist, class_dist, probs

    @staticmethod
    def distance_predict_matching_net(feat, labels, unique_labels, support_set_idxes, support_set_labels, temp):
        class_feat = feat[support_set_idxes]
        shot_dist = euclidean_distances(feat, class_feat) ** 2 / temp
        shot_probs = softmax(-shot_dist, axis=1)
        ord_labels = np.array([list(unique_labels).index(label) for label in support_set_labels])
        onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
        probs = np.matmul(shot_probs, onehot_labels)
        min_one = np.argmax(probs, axis=1)
        return unique_labels[min_one], class_feat, shot_dist, shot_probs, probs

    @staticmethod
    def support_nlog_likelihood(probs, labels, unique_labels, support_set_idxes, support_set_labels):
        unique_labels = list(unique_labels)
        tmp = probs[support_set_idxes, [unique_labels.index(l) for l in support_set_labels]]
        return - (np.log(tmp).mean()).item()

    @staticmethod
    def mat_support_nlog_likelihood(dists, labels, unique_labels, support_set_idxes, support_set_labels):
        s = 0.0
        unique_labels = list(unique_labels)
        for j, (idx, label) in enumerate(zip(support_set_idxes, support_set_labels)):
            if (support_set_labels == label).sum() == 1:
                continue
            remain_labels = list(support_set_labels)
            del remain_labels[j]
            ord_labels = np.array([unique_labels.index(label) for label in remain_labels])
            onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
            dist = dists[idx].tolist()
            del dist[j]
            probs = softmax(-np.asarray(dist))
            probs = np.matmul(probs, onehot_labels)
            s += np.log(probs[unique_labels.index(label)] + 1e-5)
        return -s / len(support_set_idxes)

    @staticmethod
    def make_onehot_vec(a):
        b = np.zeros((a.size, a.max()+1))
        b[np.arange(a.size), a] = 1
        return b

    def __init__(self, feat, labels, name, support_set_idxes=None, temp=.1, normalize=True):
        self.norm = normalize
        self.feat = feat
        self.dist = cosine_distances(self.feat, self.feat)
        if normalize:
            self.norm_mean = self.feat.mean(axis=0)
            self.feat = self.feat - self.norm_mean
            self.feat = self.feat / np.linalg.norm(self.feat, axis=1).reshape(-1,1)
        self.labels = labels
        self.unique_labels = np.unique(labels)
        self.n_class = len(self.unique_labels)
        self.temp = temp
        self.name = name
        self.hash = hashlib.sha256(self.name.encode('utf-8')).hexdigest()[:16]
        if support_set_idxes is not None:
            self.build_prototype(support_set_idxes)

    def build_prototype(self, support_set_idxes, support_set_labels):
        self.support_set_idxes = support_set_idxes
        self.support_set_labels = support_set_labels
        USE_TYPE = BasicFewShotClassifier.SELECTED_TYPE #
        if USE_TYPE == 'all_':
            self.all_pred, self.all_class_feat, self.all_class_dist, self.all_probs = self.distance_predict_combine(
                self.feat, self.labels, self.unique_labels, self.support_set_idxes, self.support_set_labels, self.temp)
        if USE_TYPE == 'ind_':
            self.ind_pred, self.ind_class_feat, self.ind_shot_dist, self.ind_class_dist, self.ind_probs = self.distance_predict_individual(
                self.feat, self.labels, self.unique_labels, self.support_set_idxes, self.support_set_labels, self.temp)
        if USE_TYPE == 'mat_':
            self.mat_pred, self.mat_class_feat, self.mat_shot_dist, self.mat_shot_probs, self.mat_probs = self.distance_predict_matching_net(
                self.feat, self.labels, self.unique_labels, self.support_set_idxes, self.support_set_labels, self.temp)


        attrs = ['pred', 'class_feat', 'probs', 'acc', 'margin', 'coverage', 'nlog_likelihood']
        for USE_TYPE in BasicFewShotClassifier.ALL_TYPES:
            setattr(self, USE_TYPE + "acc", ((getattr(self, USE_TYPE + "pred") == self.labels).sum() / len(self.labels)).item())
            setattr(self, USE_TYPE + "coverage", self._get_coverage(getattr(self, USE_TYPE + "probs"), self.n_class))
            setattr(self, USE_TYPE + "margin", self._get_margin(getattr(self, USE_TYPE + "probs")))
            setattr(self, USE_TYPE + "nlog_likelihood", self.support_nlog_likelihood(getattr(self, USE_TYPE + "probs"), self.labels,
                self.unique_labels, self.support_set_idxes, self.support_set_labels))
        self.mat_2_nlog_likelihood = self.mat_support_nlog_likelihood(self.mat_shot_dist, self.labels,
                self.unique_labels, self.support_set_idxes, self.support_set_labels)
        for attr in attrs:
            setattr(self, attr, getattr(self, USE_TYPE + attr))
        self.uncertain_pred = np.array(self.pred)
        self.uncertain_pred[self.margin < self.MARGIN_THRES] = -1
        self.nlog_likelihood = self.mat_2_nlog_likelihood

    def get_info(self):
        ret = {
            'name': self.name,
            'hash': self.hash,
            'support_set_idxes': [int(i) for i in self.support_set_idxes],
        }
        attrs = ['pred','acc', 'margin', 'probs']
        for attr in attrs:
            ret[attr] = getattr(self, attr)
            for USE_TYPE in BasicFewShotClassifier.ALL_TYPES:
                ret[USE_TYPE + attr] = getattr(self, USE_TYPE + attr)
        ret['uncertain_pred'] = self.uncertain_pred
        return ret

    def get_shot_coverage_and_margin(self, idx):
        support_set_idxes = [i for i in self.support_set_idxes]
        support_set_labels = [i for i in self.support_set_labels]
        if idx in support_set_idxes:
            new_idx = False
            loc = support_set_idxes.index(idx)
            del support_set_idxes[loc]
            del support_set_labels[loc]
        else:
            new_idx = True
            support_set_idxes.append(idx)
            support_set_labels.append(self.pred[idx])

        self.cache = dict()
        self.cache['new'] = dict()
        self.cache['old'] = dict()

        USE_TYPE = BasicFewShotClassifier.SELECTED_TYPE

        if USE_TYPE == 'all_':
            _, _, _, all_probs = self.distance_predict_combine(
                self.feat, self.labels, self.unique_labels, support_set_idxes, support_set_labels, self.temp)
        if USE_TYPE == 'ind_':
            _, _, _, _, ind_probs = self.distance_predict_individual(
                self.feat, self.labels, self.unique_labels, support_set_idxes, support_set_labels, self.temp)
        if USE_TYPE == 'mat_':
            _, _, _, mat_shot_probs, mat_probs = self.distance_predict_matching_net(
                self.feat, self.labels, self.unique_labels, support_set_idxes, support_set_labels, self.temp)

        self.cache['new'][USE_TYPE + 'coverage'] = self._get_coverage(locals()[USE_TYPE + "probs"], self.n_class)
        self.cache['new'][USE_TYPE + 'margin'] = self._get_margin(locals()[USE_TYPE + "probs"])

        attrs = [f'{t}{attr}' for t in BasicFewShotClassifier.ALL_TYPES for attr in ['coverage', 'margin']]
        for attr in attrs:
            self.cache['old'][attr] = getattr(self, attr)

        if not new_idx:
            self.cache['old'], self.cache['new'] = self.cache['new'], self.cache['old']

        ret = dict()
        for attr in attrs:
            ret[f'{attr}_diff'] = (self.cache['new'][attr] - self.cache['old'][attr]).tolist()
            ret[f'{attr}_gain'] = sum(ret[f'{attr}_diff'])
            ret[f'previous_{attr}'] = self.cache['old'][attr].tolist()
            ret[f'current_{attr}'] = self.cache['new'][attr].tolist()

        if new_idx:
            i = support_set_idxes.index(idx)
            ret['mat_shot_probs'] = mat_shot_probs[:, i].tolist()
        else:
            i = list(self.support_set_idxes).index(idx)
            ret['mat_shot_probs'] = self.mat_shot_probs[:, i].tolist()

        return {**ret}

    def make_prediction(self, feat, label):
        if self.norm:
            feat = feat - self.norm_mean
            feat = feat / np.linalg.norm(feat, axis=1).reshape(-1,1)
            temp = 0.1
        else:
            raise NotImplementedError("only consider norm")

        class_feat = self.mat_class_feat
        shot_dist = euclidean_distances(feat, class_feat) ** 2 / temp
        shot_probs = softmax(-shot_dist, axis=1)
        ord_labels = np.array([list(self.unique_labels).index(label) for label in self.support_set_labels])
        onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
        probs = np.matmul(shot_probs, onehot_labels)
        margin = BasicFewShotClassifier._get_margin(probs)
        min_one = np.argmax(probs, axis=1)
        pred = self.unique_labels[min_one]
        acc = (pred == label).sum() / len(label)
        return acc, pred, class_feat, shot_dist, shot_probs, probs, margin
        
class BasicEnsembleClassifier:

    SELECTED_TYPE = 'mat_'
    MARGIN_THRES = 0.25
    ALL_TYPES = [SELECTED_TYPE]
    def __init__(self, clfs, weights=None):
        assert(len(clfs) == len(weights))
        self.clfs = clfs
        self.clfs_weight = np.array(weights) if weights is not None else np.ones(len(self.clfs))
        self.clfs_weight = self.clfs_weight / self.clfs_weight.sum()
        self.labels = self.clfs[0].labels
        self.unique_labels = self.clfs[0].unique_labels
        self.n_class = len(self.unique_labels)
        self.n_sample = len(self.clfs[0].feat)
        self.n_clf = len(self.clfs)
        self.dist = np.array([clf.dist for clf in self.clfs]).mean(axis=0)

    def build_prototype(self, support_set_idxes, support_set_labels, skip_baselearner=False):
        self.support_set_idxes = support_set_idxes
        self.support_set_labels = support_set_labels
        if not skip_baselearner:
            for clf in self.clfs:
                clf.build_prototype(support_set_idxes, support_set_labels)

        USE_TYPE = BasicEnsembleClassifier.SELECTED_TYPE
        if USE_TYPE == 'all_':
            self.all_pred, self.all_probs = self.all_detail_predict()
        if USE_TYPE == 'all_2_':
            self.all_2_pred, self.all_2_probs = self.all_2_detail_predict()
        if USE_TYPE == 'ind_':
            self.ind_pred, self.ind_probs = self.ind_detail_predict()
        if USE_TYPE == 'ind_2_':
            self.ind_2_pred, self.ind_2_probs = self.ind_2_detail_predict()
        if USE_TYPE == 'mat_':
            self.mat_pred, self.mat_shot_probs, self.mat_probs = self.mat_detail_predict()
        if USE_TYPE == 'mat_2_':
            self.mat_2_pred, self.mat_2_shot_probs, self.mat_2_probs = self.mat_2_detail_predict()

        for USE_TYPE in BasicEnsembleClassifier.ALL_TYPES:
            setattr(self, USE_TYPE + 'acc', ((getattr(self, USE_TYPE+'pred') == self.labels).sum() / self.n_sample))
            setattr(self, USE_TYPE + 'coverage', BasicFewShotClassifier._get_coverage(getattr(self, USE_TYPE+'probs'), self.n_class))
            setattr(self, USE_TYPE + 'margin', BasicFewShotClassifier._get_margin(getattr(self, USE_TYPE+'probs')))


        attrs = ['probs', 'pred', 'acc', 'margin', 'coverage']
        for attr in attrs:
            setattr(self, attr, getattr(self, USE_TYPE + attr))
        self.uncertain_pred = np.array(self.pred)
        self.uncertain_pred[self.margin < self.MARGIN_THRES] = -1

        self.mean_dist = np.asarray([clf.dist for clf in self.clfs]).mean(axis=0)
        self.mean_margin = np.asarray([clf.margin for clf in self.clfs]).mean(axis=0)
        self.mean_coverage = np.asarray([clf.coverage for clf in self.clfs]).mean(axis=0)


    def all_detail_predict(self):
        probs = np.zeros(self.clfs[0].all_probs.shape)
        for i, clf in enumerate(self.clfs):
            probs += clf.all_probs * self.clfs_weight[i]
        min_one = np.argmax(probs, axis=1)
        pred = self.unique_labels[min_one]
        return pred, probs

    def all_2_detail_predict(self):
        dists = np.zeros(self.clfs[0].all_class_dist.shape)
        for i, clf in enumerate(self.clfs):
            dists += clf.all_class_dist * self.clfs_weight[i]
        probs = softmax(-dists, axis=1)
        min_one = np.argmax(-dists, axis=1)
        pred = self.unique_labels[min_one]
        return pred, probs

    def ind_detail_predict(self):
        probs = np.zeros(self.clfs[0].ind_probs.shape)
        for i, clf in enumerate(self.clfs):
            probs += clf.ind_probs * self.clfs_weight[i]
        min_one = np.argmax(probs, axis=1)
        pred = self.unique_labels[min_one]
        return pred, probs

    def ind_2_detail_predict(self):
        dists = np.zeros(self.clfs[0].ind_class_dist.shape)
        for i, clf in enumerate(self.clfs):
            dists += clf.ind_class_dist * self.clfs_weight[i]
        probs = softmax(-dists, axis=1)
        min_one = np.argmax(-dists, axis=1)
        pred = self.unique_labels[min_one]
        return pred, probs

    def mat_detail_predict(self): # softmax -> avg on class and base learner
        shot_probs = np.zeros(self.clfs[0].mat_shot_probs.shape)
        for i, clf in enumerate(self.clfs):
            shot_probs += clf.mat_shot_probs * self.clfs_weight[i]
        ord_labels = np.array([list(self.unique_labels).index(label) for label in self.clfs[0].support_set_labels])
        onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
        probs = np.matmul(shot_probs, onehot_labels)
        min_one = np.argmax(probs, axis=1)
        pred = self.unique_labels[min_one]
        return pred, shot_probs, probs


    def mat_2_detail_predict(self):  # avg on base learner -> softmax -> avg on class
        shot_dists = np.zeros(self.clfs[0].mat_shot_dist.shape)
        for i, clf in enumerate(self.clfs):
            shot_dists += clf.mat_shot_dist * self.clfs_weight[i]
        shot_probs = softmax(-shot_dists, axis=1)
        ord_labels = np.array([list(self.unique_labels).index(label) for label in self.clfs[0].support_set_labels])
        onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
        probs = np.matmul(shot_probs, onehot_labels)
        min_one = np.argmax(probs, axis=1)
        pred = self.unique_labels[min_one]
        return pred, shot_probs, probs

    def get_info(self, order=None):
        ret = {}
        attrs = ['probs', 'pred', 'acc', 'margin']
        for attr in attrs:
            ret[attr] = getattr(self, attr)
        ret['uncertain_pred'] = self.uncertain_pred
        return ret

    def get_shot_coverage_and_margin(self, idx):
        support_set_idxes = [i for i in self.support_set_idxes]
        support_set_labels = [i for i in self.support_set_labels]
        if idx in support_set_idxes:
            new_idx = False
            loc = support_set_idxes.index(idx)
            del support_set_idxes[loc]
            del support_set_labels[loc]
        else:
            new_idx = True
            support_set_idxes.append(idx)
            support_set_labels.append(self.pred[idx])
        for clf in self.clfs:
            clf.build_prototype(support_set_idxes, support_set_labels)

        self.cache = dict()
        self.cache['new'] = dict()
        self.cache['old'] = dict()
        USE_TYPE = BasicEnsembleClassifier.SELECTED_TYPE
        if USE_TYPE == 'all_':
            _, all_probs = self.all_detail_predict()
        if USE_TYPE == 'all_2_':
            _, all_2_probs = self.all_2_detail_predict()
        if USE_TYPE == 'ind_':
            _, ind_probs = self.ind_detail_predict()
        if USE_TYPE == 'ind_2_':
            _, ind_2_probs = self.ind_2_detail_predict()
        if USE_TYPE == 'mat_':
            _, mat_shot_probs, mat_probs = self.mat_detail_predict()
        if USE_TYPE == 'mat_2_':
            _, mat_2_shot_probs, mat_2_probs = self.mat_2_detail_predict()

        self.cache['new'][USE_TYPE + 'coverage'] = BasicFewShotClassifier._get_coverage(locals()[USE_TYPE + "probs"], self.n_class)
        self.cache['new'][USE_TYPE + 'margin'] = BasicFewShotClassifier._get_margin(locals()[USE_TYPE + "probs"])

        attrs = [f'{t}{attr}' for t in BasicEnsembleClassifier.ALL_TYPES for attr in ['coverage', 'margin']]
        for attr in attrs:
            self.cache['old'][attr] = getattr(self, attr)

        if not new_idx:
            self.cache['old'], self.cache['new'] = self.cache['new'], self.cache['old']

        ret = dict()
        for attr in attrs:
            ret[f'{attr}_diff'] = (self.cache['new'][attr] - self.cache['old'][attr]).tolist()
            ret[f'{attr}_gain'] = sum(ret[f'{attr}_diff'])
            ret[f'previous_{attr}'] = self.cache['old'][attr].tolist()
            ret[f'current_{attr}'] = self.cache['new'][attr].tolist()
        if new_idx:
            i = support_set_idxes.index(idx)
            ret['mat_shot_probs'] = mat_shot_probs[:, i].tolist()
            ret['mat_shot_passive'] = self.mat_shot_probs[idx,:].tolist()
        else:
            i = list(self.support_set_idxes).index(idx)
            ret['mat_shot_probs'] = self.mat_shot_probs[:, i].tolist()

        for clf in self.clfs:
            clf.build_prototype(self.support_set_idxes, self.support_set_labels)

        return {**ret, 'idx': idx}

    def make_prediction(self, feats, label):
        print(len(feats), len(self.clfs))
        learners_info = [clf.make_prediction(feat, label) for feat, clf in zip(feats, self.clfs)]
        shot_probs = np.zeros(learners_info[0][4].shape)
        for i, info in enumerate(learners_info):
            shot_probs += info[4] * self.clfs_weight[i]
        ord_labels = np.array([list(self.unique_labels).index(label) for label in self.clfs[0].support_set_labels])
        onehot_labels = BasicFewShotClassifier.make_onehot_vec(ord_labels)
        probs = np.matmul(shot_probs, onehot_labels)
        margin = BasicFewShotClassifier._get_margin(probs)
        min_one = np.argmax(probs, axis=1)
        pred = self.unique_labels[min_one]
        uncertain_pred = np.array(pred)
        uncertain_pred[margin < 0.25] = -1
        return {
            'ensemble_info': ((pred == label).sum() / len(label), pred, None, None, shot_probs, probs, margin, uncertain_pred),
            'learner_info': learners_info
        }


class EnsembleClassifier:
    info_attrs = ['mat_margin']
    def __init__(self, clfs, n_init=3, seed=3, idxes=None):
        self.clfs = clfs
        self.clfs_weight = np.ones(len(self.clfs))
        self.hashmap = {clf.hash: clf for clf in self.clfs}
        self.labels = self.clfs[0].labels
        self.unique_labels = np.unique(self.labels)
        if idxes is None:
            def random_shot(label, n_shot, seed=42):
                n_class = len(np.unique(label))
                np.random.seed(seed)
                shot = np.random.choice(np.arange(len(label)), n_shot, replace=False)
                while len(np.unique(label[shot])) != n_class:
                    shot = np.random.choice(np.arange(len(label)), n_shot, replace=False)
                return sorted(list(shot))
            self.support_set_idxes = random_shot(self.labels, n_init * len(self.unique_labels), seed)
        else:
            self.support_set_idxes = idxes
        self.support_set_labels = [self.labels[i] for i in self.support_set_idxes]
        for clf in clfs: clf.build_prototype(self.support_set_idxes, self.support_set_labels)

        self.learner_cluster = None
        self.label_cluster = None

        self.init_model = BasicEnsembleClassifier(self.clfs, self.clfs_weight)
        self.init_model.build_prototype(self.support_set_idxes, self.support_set_labels)

        self.selected_clf_idxes = self.get_initial_learner()
        self._build_ensemble()
        self.get_learner_cluster()
        self.get_label_cluster()
        print(self.init_model.acc, self.ensemble.acc)

    def get_initial_learner(self):
        clfs = [clf for clf in self.clfs if clf.margin.mean() > 0.5]
        init_model = BasicEnsembleClassifier(clfs, np.ones(len(clfs)))
        init_model.build_prototype(self.support_set_idxes, self.support_set_labels, True)
        dist = 1 - np.concatenate([clf.margin.reshape(1,-1) for clf in clfs])
        l_star = dist.sum(axis=1).argmin()
        model_reg= sorted(np.asarray([np.linalg.norm(dist[i] - dist[l_star], ord=1) for i in range(len(dist))]))[1] * 0.75
        model_prior = np.asarray([clf.nlog_likelihood for clf in clfs])
        model_prior = np.sqrt(np.sqrt(model_prior))
        model_prior = model_prior / model_prior.mean()
        model_prior = (1 + model_prior) / 2
        cooperation = np.zeros((len(clfs), len(clfs)))
        for i, clf1 in enumerate(clfs):
            for j, clf2 in enumerate(clfs):
                if i < j:
                    val = np.mean([entropy(clf1.probs[k], clf2.probs[k]) + entropy(clf2.probs[k], clf1.probs[k]) for k in range(len(self.labels))])
                    cooperation[i,j] = cooperation[j,i] = val
        result = DS3(dist, model_reg).ADMM(1e-1, 1e-5, 1e4, np.inf, [], 0, model_prior)
        selected_clf_idxes = [i for i, val in enumerate(result[1].max(axis=1)) if val > 0.0995]
        return [self.clfs.index(clfs[i]) for i in selected_clf_idxes]
        
    def _build_ensemble(self):
        self.ensemble = BasicEnsembleClassifier([self.clfs[i] for i in self.selected_clf_idxes], [self.clfs_weight[i] for i in self.selected_clf_idxes])
        for clf in self.clfs:
            clf.build_prototype(self.support_set_idxes, self.support_set_labels)
        self.ensemble.build_prototype(self.support_set_idxes, self.support_set_labels, True)

    def update(self, support_set_idxes, support_set_labels, selected_clf_idxes, clfs_weight):
        self.support_set_idxes = np.asarray(support_set_idxes)
        self.support_set_labels = np.asarray(support_set_labels)
        if selected_clf_idxes is not None: self.selected_clf_idxes = selected_clf_idxes
        if clfs_weight is not None: self.clfs_weight = clfs_weight
        self._build_ensemble()

    def search_weight(self, learner_idx, sample_idxes, increase):
        other_idxes = np.setdiff1d(np.arange(len(self.ensemble.pred)), sample_idxes)
        previous_weight = self.clfs_weight[learner_idx]
        previous_pred = self.ensemble.pred
        if increase:
            target_pred = self.clfs[learner_idx].pred
        else:
            self.clfs_weight[learner_idx] = 0
            self._build_ensemble()
            target_pred = self.ensemble.pred
        best_weight, best_score = -1, -1
        for i in range(1,5):
            if increase:
                self.clfs_weight[learner_idx] = previous_weight + i / 5
            else:
                self.clfs_weight[learner_idx] = previous_weight - i / 5
            self._build_ensemble()
            score = (target_pred[sample_idxes]==self.ensemble.pred[sample_idxes]).mean() +\
             (previous_pred[other_idxes]==self.ensemble.pred[other_idxes]).mean()
            print(i, score)
            if score > best_score:
                best_weight = self.clfs_weight[learner_idx]
        print('result', best_weight)
        return best_weight
        
    def adjust_baselearner(self, learner_idx):
        is_new = learner_idx not in self.selected_clf_idxes
        new_selected_clf_idxes = list(self.selected_clf_idxes)
        if is_new:
            new_selected_clf_idxes.append(learner_idx)
        else:
            del new_selected_clf_idxes[new_selected_clf_idxes.index(learner_idx)]
        new_ensemble = BasicEnsembleClassifier([self.clfs[i] for i in new_selected_clf_idxes], [self.clfs_weight[i] for i in new_selected_clf_idxes])
        new_ensemble.build_prototype(self.support_set_idxes, self.support_set_labels)
        old_ensemble = self.ensemble
        if not is_new:
            new_ensemble, old_ensemble = old_ensemble, new_ensemble
        ret = dict()
        ret['old_margin'] = old_ensemble.margin
        ret['new_margin'] = new_ensemble.margin
        ret['margin_diff'] = new_ensemble.margin - old_ensemble.margin
        ret['old_pred'] = old_ensemble.pred
        ret['old_uncertain_pred'] = old_ensemble.uncertain_pred
        ret['new_pred'] = new_ensemble.pred
        ret['new_uncertain_pred'] = new_ensemble.uncertain_pred
        ret['lift'] = ret['margin_diff'].sum()
        return ret

    def get_candidate(self, i, num=3):
        dist = self.ensemble.dist
        sort = dist[i].argsort()
        return [int(x) for x in sort[1:] if x not in self.support_set_idxes][:num]

    @staticmethod
    def recommend_shot_from_dist_margin(dist, margin=None, c=1):
        l_star = dist.sum(axis=1).argmin()
        reg = np.asarray([np.linalg.norm(dist[i] - dist[l_star], ord=1) for i in range(len(dist))]).max() / 2
        if margin is not None:
            margin = np.sqrt(margin)
            margin = margin / margin.mean()
        penalty = 0
        result = DS3(dist, reg / c).ADMM(1e-1, 1e-5, 1e4, np.inf, [], penalty, margin)[-2]
        return result
        

    def recommend_shot_from_selected(self, idxes, n=-1):
        if n == -1: n = max(1, len(idxes)/10)
        dist, margin = self.ensemble.dist[idxes,:][:,idxes], self.ensemble.margin[idxes]
        result = EnsembleClassifier.recommend_shot_from_dist_margin(dist, margin, n)
        return np.asarray(idxes)[result]

    def recommend_shot_DS3(self, n_shot):
        dist, shot, margin = self.ensemble.dist, self.support_set_idxes, self.ensemble.margin
        l_star = dist.sum(axis=1).argmin()
        reg = np.asarray([np.linalg.norm(dist[i] - dist[l_star], ord=1) for i in range(len(dist))]).max() / 2
        margin = np.sqrt(margin)
        margin = margin / margin.mean()
        margin = (1 + margin) / 2
        penalty = 0.1
        c = n_shot + len(self.support_set_idxes)
        #c /= 0.8**3
        while True:
            result = DS3(dist, reg / c).ADMM(1e-1, 1e-5, 1e4, np.inf, shot, penalty, margin)[-2]
            print(c, len(result))
            if len(result) < n_shot + len(self.support_set_idxes):
                c /= 0.8
            else:
                break
        return [int(i) for i in result if i not in self.support_set_idxes], [int(i) for i in self.support_set_idxes if i not in result], result
    
    def recommend_learner(self):
        self.init_model = BasicEnsembleClassifier(self.clfs, self.clfs_weight)
        self.init_model.build_prototype(self.support_set_idxes, self.support_set_labels)
        self.model_img_dist = dist = 1 - np.concatenate([clf.margin.reshape(1,-1) for clf in self.clfs])
        l_star = dist.sum(axis=1).argmin()
        self.model_reg = np.asarray([np.linalg.norm(dist[i] - dist[l_star], ord=1) for i in range(len(dist))]).max() / 2

        self.model_prior = np.asarray([clf.nlog_likelihood for clf in self.clfs])
        self.model_prior = np.sqrt(self.model_prior)
        self.model_prior = self.model_prior / self.model_prior.mean()
        self.model_prior = (1 + self.model_prior) / 2

        self.cooperation = np.zeros((len(self.clfs), len(self.clfs)))
        for i, clf1 in enumerate(self.clfs):
            for j, clf2 in enumerate(self.clfs):
                if i < j:
                    val = np.mean([entropy(clf1.probs[k], clf2.probs[k]) + entropy(clf2.probs[k], clf1.probs[k]) for k in range(len(self.labels))])
                    self.cooperation[i,j] = self.cooperation[j,i] = val
        print("begin DS3")
        selected_clf_idxes = DS3(self.model_img_dist, self.model_reg).ADMM(1e-1, 1e-5, 1e4, np.inf, self.selected_clf_idxes, 0.5, self.model_prior, self.cooperation)[-2]
        print(selected_clf_idxes)
        while len(selected_clf_idxes) <= 1:
            self.model_reg *= 0.9
            selected_clf_idxes = DS3(self.model_img_dist, self.model_reg).ADMM(1e-1, 1e-5, 1e4, np.inf, self.selected_clf_idxes, 0.5, self.model_prior)[-2]
        return selected_clf_idxes

    @staticmethod
    def relation(ensemble, clf1, clf2, attr, label, thres):
        if label is not None:
            a = (np.asarray(getattr(clf1, attr)) > thres)[ensemble.pred == label]
            b = (np.asarray(getattr(clf2, attr)) > thres)[ensemble.pred == label]
        else:
            a = np.asarray(getattr(clf1, attr)) > thres
            b = np.asarray(getattr(clf2, attr)) > thres
        return {
            'both': (a & b).sum().item(),
            'clf1': (a & ~b).sum().item(),
            'clf2': (~a & b).sum().item(),
            'neither': (~a & ~b).sum().item(),
            'diff': (a & ~b).sum().item() + (~a & b).sum().item(),

            'both_idx': np.where(a & b)[0].tolist(),
            'clf1_idx': np.where(a & ~b)[0].tolist(),
            'clf2_idx': np.where(~a & b)[0].tolist(),
            'neither_idx': np.where(~a & ~b)[0].tolist(),
        }

    @staticmethod
    def ensemble_pred_relation(ensemble, clf1, clf2, label):
        if label is not None:
            a = (clf1.pred == ensemble.pred)[ensemble.pred==label]
            b = (clf2.pred == ensemble.pred)[ensemble.pred==label]
        else:
            a = clf1.pred == ensemble.pred
            b = clf2.pred == ensemble.pred
        return {
            'both': (a & b).sum().item(),
            'clf1': (a & ~b).sum().item(),
            'clf2': (~a & b).sum().item(),
            'neither': (~a & ~b).sum().item(),
            'diff': (a & ~b).sum().item() + (~a & b).sum().item(),

            'both_idx': np.where(a & b)[0].tolist(),
            'clf1_idx': np.where(a & ~b)[0].tolist(),
            'clf2_idx': np.where(~a & b)[0].tolist(),
            'neither_idx': np.where(~a & ~b)[0].tolist(),
            'diff_idx': np.where((a & ~b) | (~a & b))[0].tolist(),
        }


    @staticmethod
    def _mutual_relation(labels1, labels2, label):
        if label is not None:
            a = (labels1 == label)
            b = (labels2 == label)
            return {
                'both': (a & b).sum().item(),
                'clf1': (a & ~b).sum().item(),
                'clf2': (~a & b).sum().item(),
                'diff': (a & ~b).sum().item() + (~a & b).sum().item(),

                'both_idx': np.where(a & b)[0].tolist(),
                'clf1_idx': np.where(a & ~b)[0].tolist(),
                'clf2_idx': np.where(~a & b)[0].tolist(),
                'diff_idx': np.where((a & ~b) | (~a & b))[0].tolist(),
            }
        else:
            return {
                'same': (labels1 == labels2).sum().item(),
                'diff': (labels1 != labels2).sum().item(),
                'same_idx': np.where(labels1 == labels2)[0].tolist(),
                'diff_idx': np.where(labels1 != labels2)[0].tolist(),
            }

    def cell2_info(self, hash1, thres):
        clf1 = self.hashmap[hash1]
        clf2 = self.ensemble
        infos = dict()
        #for attr in EnsembleClassifier.info_attrs:
        #    infos[f'{attr}_relation'] = self.relation(self.ensemble, clf1, clf2, attr, None, thres)
        #    infos[f'{attr}_relation_detail'] = { int(label): self.relation(self.ensemble, clf1, clf2, attr, label, thres) for label in self.unique_labels }
        #infos['pred'] = self._mutual_relation(clf1.pred, clf2.pred, None)
        #infos['pred_detail'] = { int(label): self._mutual_relation(clf1.pred, clf2.pred, label) for label in self.unique_labels }
        #infos['uncertain_pred'] = self._mutual_relation(clf1.uncertain_pred, clf2.uncertain_pred, None)
        #infos['uncertain_pred_detail'] = { int(label): self._mutual_relation(clf1.uncertain_pred, clf2.uncertain_pred, label) for label in list(self.unique_labels) + [-1] }
        #infos['confusion_matrix'] = confusion_matrix(clf1.pred, clf2.pred).tolist()
        return infos

    def get_info(self):
        info = dict()
        info['learner_cluster'] = self.get_learner_cluster()
        info['label_cluster'] = self.get_label_cluster()
        info['support_set_idxes'] = [int(i) for i in self.support_set_idxes]
        info['support_set_labels'] = [int(i) for i in self.support_set_labels]
        info['selected_clf_idxes'] = self.selected_clf_idxes
        info['hashes'] = [clf.hash for clf in self.clfs]
        info['model_info'] = [clf.get_info() for clf in self.clfs]
        info['ensemble_info'] = self.ensemble.get_info()
        info['clfs_weight'] = self.clfs_weight
        #info['clfs_prior'] = self.model_prior.tolist()
        info['cell2'] = dict()
        for i in range(len(self.clfs)):
            info['cell2'][info['hashes'][i]] = self.cell2_info(info['hashes'][i], 1/2)
        return info

    def get_learner_cluster(self):
        is_mnist = np.mean([x.nlog_likelihood for x in self.clfs]) < 3 
        if self.learner_cluster is not None:
            return self.learner_cluster
        n_sample = len(self.labels)
        n_learner = len(self.clfs)
        prob_dist = np.zeros((n_learner,n_learner))
        for i in range(n_learner):
            for j in range(i + 1, n_learner):
                probs1, probs2 = self.clfs[i].probs, self.clfs[j].probs
                val = np.mean([(entropy(probs1[k], probs2[k]) + entropy(probs2[k], probs1[k])) for k in range(n_sample)])
                prob_dist[i,j] = prob_dist[j,i] = val

        coverage_avg = np.mean([x.coverage.mean() for x in self.clfs])
        likelihood_avg = np.mean([x.nlog_likelihood for x in self.clfs])
        if is_mnist:
            others_idx = [i for i, x in enumerate(self.clfs) if x.coverage.mean() < 1 * coverage_avg and x.nlog_likelihood > 0.8 * likelihood_avg]
        else:
            others_idx = [i for i, x in enumerate(self.clfs) if x.coverage.mean() < 1 * coverage_avg or x.nlog_likelihood > 1.1 * likelihood_avg]


        remains_idx = [i for i in range(len(self.clfs)) if i not in others_idx]
        dist = prob_dist[remains_idx,:][:,remains_idx]
        learner_cluster = EnsembleClassifier.build_cluster(dist, 3)
        self.learner_cluster = dict()
        for k,v in learner_cluster.items():
            self.learner_cluster[remains_idx[k]] = v
        other = np.max(list(self.learner_cluster.values()))+1
        for idx in others_idx:
            self.learner_cluster[idx] = other
        print(self.learner_cluster)
        return self.learner_cluster

    @staticmethod
    def build_cluster(dist, first_layer=3):
        ret = dict()
        index = 0
        model = AgglomerativeClustering(distance_threshold=None, n_clusters=first_layer, affinity='precomputed',linkage='complete')
        model.fit(dist)
        coarse_labels = model.labels_
        for label in np.unique(coarse_labels):
            idxes = [i for i, val in enumerate(coarse_labels) if val == label]
            if len(idxes) == 1:
                ret[idxes[0]] = index + l
            else:
                sub_dist = dist[idxes,:][:,idxes]
                model = AgglomerativeClustering(distance_threshold=np.mean(sub_dist) * 1.2, n_clusters=None, affinity='precomputed',linkage='complete')
                model.fit(sub_dist)
                for i, l in enumerate(model.labels_):
                    ret[idxes[i]] = index + l
            index += np.max(model.labels_) + 1
        return ret

    def get_label_cluster(self):
        if self.label_cluster is not None:
            return self.label_cluster
        if len(self.unique_labels) <= 10:
            return list(self.unique_labels)
        else:
            return [0,1,2,3,4,3,0,2,1,5,6,7,8,5,1,1,9,3,0,8]
        class_dist = np.zeros((len(self.unique_labels),len(self.unique_labels)))
        for clf in self.clfs:
            _, feat, _, _ = clf.distance_predict_combine(clf.feat, clf.labels, clf.unique_labels, clf.support_set_idxes, clf.support_set_labels, clf.temp)
            class_dist += euclidean_distances(feat, feat)
        class_dist = class_dist / len(self.clfs)
        label_name_dist = np.load('/home/vica/fsl_data/cifar' + '/extra_data/label_glove_dist.npy')
        class_dist += label_name_dist
        model = AgglomerativeClustering(distance_threshold=None, n_clusters=10)
        model = model.fit(class_dist)
        self.label_cluster = model.labels_
        tmp = -1
        for i in range(len(self.label_cluster)):
            if self.label_cluster[i] >= 0:
                self.label_cluster[self.label_cluster==self.label_cluster[i]] = tmp
                tmp -= 1
        self.label_cluster = -self.label_cluster - 1
        return self.label_cluster

