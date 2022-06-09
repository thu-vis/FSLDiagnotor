LearnerCluster = function () {
  const that = this;
  that.learner2name = null;
  that.cluster2name = null;
  that.learner2cluster = null; // change when expand/collapse
  that.origin_learner2cluster = null; // not change
  that.N = 0; // learner num
  that.n = 0; // cluster num
  that.used_cluster_names = [];
  that.clear = function() {
    that.learner2cluster = null;
    }   
  that.update = function() {
      Matrix.full_update();
  }
  that.get_all_learner = cluster => filter_idx(that.learner2cluster, d=>d===cluster);
  that.get_min_learner = cluster => that.get_all_learner(cluster)[0];
  that.get_id = cluster => that.get_all_learner(cluster).join(',')
  that.get_cluster_from_learner = function(learner) {
      let cluster = that.learner2cluster[learner];
      let learners_with_same_cluster = that.get_all_learner(cluster)
      let idx = learners_with_same_cluster.indexOf(learner);
      return [cluster, idx];
  }
  that.init = function(ensemble) {
      that.N = ensemble.model_info.length;
      that.learner2cluster = [];
      FE(that.N).forEach(i => that.learner2cluster[i] = ensemble.learner_cluster[i]);
      that.learner2cluster = adjust_cluster_ordered(that.learner2cluster, ensemble.selected_clf_idxes);
      that.origin_learner2cluster = that.learner2cluster.slice();
      that.unique_cluster = Array.from(new Set(that.learner2cluster));
      that.n = that.unique_cluster.length;
      that.learner2name = ensemble.model_info.map(d => d.name);
      that.used_cluster_names = [];
      that.cluster2name = FE(that.n).map(that.get_cluster_name);
      for (let learner of ensemble.selected_clf_idxes)that.expand_learner(learner, false)
      //that.expand_all();
      //that.shrink_learner(0, false);
      //that.shrink_learner(23, false);
  }

  that.shrink_name = function(name) {
    if (name == 'imagenet') return 'image';
    if (name == 'quickdraw') return 'draw';
    if (name == 'vgg_flower') return 'flower';
    return name;
  }

  that.get_cluster_name = function(cluster) {
    let names = that.get_all_learner(cluster).map(l => that.learner2name[l]);
    if (names.length == 1) return 'BL-' + that.shrink_name(names[0]);
    if (names.includes('vgg_flower')) return `(${names.length})  C-others`;
    if (names.map(d => d.includes('mini')).reduce((a,b)=>a&&b)) {
        let cnt = that.used_cluster_names.filter(d => d.includes('mini')).length;
        const name = `(${names.length})  C-mini-${String.fromCharCode(65 + cnt)}`;
        that.used_cluster_names.push(name);
        return name;
    }
    if (names.map(d => d.includes('tiered')).reduce((a,b)=>a&&b)) {
        let cnt = that.used_cluster_names.filter(d => d.includes('tiered')).length;
        const name = `(${names.length})  C-tiered-${String.fromCharCode(65 + cnt)}`;
        that.used_cluster_names.push(name);
        return name;
    }
    return that.get_all_learner(cluster).map(l => that.learner2name[l]).join(',')
  }

  that.get_cluster_type = function(cluster) {
      // 0: always single learner, 1: expanded single learner, 2: multi learner
      let num = that.learner2cluster.filter(x => x === cluster).length;
      let learner = that.learner2cluster.indexOf(cluster);
      let origin_cluster = that.origin_learner2cluster[learner];
      let origin_learners = filter_idx(that.origin_learner2cluster, d=> d===origin_cluster);
      let origin_num = origin_learners.length;
      if (origin_num === 1) return 0;
      if (num === 1) return 1;
      return 2;
  }
  that.get_learner_type = learner => that.get_cluster_type(that.learner2cluster[learner]);

  that.expand_all = function() {
      for (let learner = 0; learner < that.N; ++learner)that.expand_learner(learner, false);
  }
  that.expand_learner = function(learner, update=true) {
      that._expand_cluster(that.learner2cluster[learner], update);
  }
  that._expand_cluster = function(cluster, update=true) {
      let tmp = [];
      let new_cluster = cluster;
      let num = that.learner2cluster.filter(x => x === cluster).length;
      if (num === 1) return;
      for (let i = 0; i < that.N; ++i) {
          if (that.learner2cluster[i] < cluster) {
              tmp[i] = that.learner2cluster[i];
          } else if (that.learner2cluster[i] > cluster) {
              tmp[i] = that.learner2cluster[i] + num - 1;
          } else {
              tmp[i] = new_cluster;
              new_cluster++;
          }
      }
      that.learner2cluster = tmp;
      that.n = Math.max(...tmp) + 1;
      that.used_cluster_names = [];
      that.cluster2name = FE(that.n).map(that.get_cluster_name);
      if (update) that.update();
  }
  that.shrink_learner = function(learner, update=true) {
      that._shrink_cluster(that.learner2cluster[learner], update);
  }
  that._shrink_cluster = function(cluster, update=true) {
      let tmp = [];
      let learner = that.learner2cluster.indexOf(cluster);
      let origin_cluster = that.origin_learner2cluster[learner];
      let origin_learners = filter_idx(that.origin_learner2cluster, d=>d===origin_cluster);
      let min_cluster = Math.min(...origin_learners.map(l => that.learner2cluster[l]));
      let max_cluster = Math.max(...origin_learners.map(l => that.learner2cluster[l]));
      let offset = max_cluster - min_cluster;
      if (offset === 0) return;
      for (let i = 0; i < that.N; ++i) {
          if (that.learner2cluster[i] < min_cluster) {
              tmp[i] = that.learner2cluster[i];
          } else if (that.learner2cluster[i] > max_cluster) {
              tmp[i] = that.learner2cluster[i] - offset;
          } else {
              tmp[i] = min_cluster;
          }
      }
      that.learner2cluster = tmp;
      that.n = Math.max(...tmp) + 1;
      that.used_cluster_names = [];
      that.cluster2name = FE(that.n).map(that.get_cluster_name);
      if (update) that.update();
  }
  
  that.get_height = function(cluster) {
    return that.get_cluster_type(cluster) == 2 ? 100 : 100;
    }
}
