# anneal: simulated annealing algorithm
# 𝑂(N) time: There is a large constant, which is determined by the parameters
import numpy as np


def rotateForBest(M, path):
    N = len(path)
    dists = []
    dists.append(M[path[N - 1], path[0]])
    for i in range(0, N-1):
        dists.append(M[path[i], path[i+1]])
    start = np.argmax(dists)
    newpath = path[start:] + path[:start]
    newsum = np.sum(dists) - dists[start]
    return newpath, newsum


def changeXandY(M, path, x, y):
    # change x and y to get new answer
    N = len(path)
    newpath = path[:]
    newpath[x], newpath[y] = newpath[y], newpath[x]
    newsum = 0
    for i in range(0, N-1):
        newsum += M[newpath[i], newpath[i+1]]
    return newpath, newsum


def simulateAnneal(M, Ts, Tf, alpha, l):
    # Ts: start temperature
    # Tf: finish temperature
    # alpha: rate of decline
    # l: loop time in 1 Tc
    N = len(M)
    sum = 0
    path = []
    for i in range(0, N - 1):
        sum += M[i, i + 1]
        path.append(i)
    path.append(N - 1)

    Tc = Ts  # Tc: current temperature
    while Tc > Tf:
        # rotate for best
        for i in range(0, l):
            path, sum = rotateForBest(M, path)
            x = np.random.randint(0, N)
            y = np.random.randint(0, N)
            while x == y:
                y = np.random.randint(0, N)
            if x > y:
                x, y = y, x
            newpath, newsum = changeXandY(M, path, x, y)
            if newsum < sum or np.random.rand() < np.exp(-1 * (newsum - sum) / Tc):
                sum = newsum
                path = newpath
        # change temperature
        Tc *= alpha
    return path, sum


def multiSimulateAnneal(n, M, Ts, Tf, alpha, l):
    # loop n for best
    path, sum = simulateAnneal(M, Ts, Tf, alpha, l)
    for i in range(0, n-1):
        newpath, newsum = simulateAnneal(M, Ts, Tf, alpha, l)
        if newsum < sum:
            sum = newsum
            path = newpath
    return path, sum

# => The results are influenced by dsize
