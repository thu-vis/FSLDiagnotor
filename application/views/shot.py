import numpy as np
from sklearn.metrics.pairwise import euclidean_distances, cosine_distances


def greedy_search(n, k, utility, shots=[]):
    best_score = utility(shots)
    for _ in range(k):
        best_candidate = -1
        for candidate in range(n):
            if candidate in shots:
                continue
            score = utility(shots + [candidate])
            if score > best_score:
                best_score, best_candidate = score, candidate
        shots.append(best_candidate)
    return shots


def greedy_search_with_balanced(label, n, k, utility, shots=[]):
    assert(len(label) == n)
    cnt = {l:0 for l in np.unique(label)}
    for _ in range(k):
        result = []
        for candidate in range(n):
            if candidate in shots:
                continue
            score = utility(shots + [candidate])
            result.append((score, candidate))
        result = sorted(result,key=lambda x:x[0])
        for _,i in result:
            if cnt[label[i]] != 5:
                shots.append(i)
                cnt[label[i]] += 1
                break
    return shots