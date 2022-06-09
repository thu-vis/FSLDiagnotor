LabelCluster = function () {
    const that = this;
    that.origin_label_cluster = null;
    that.origin_open_cluster = null;

    that.cluster2colors = null;
    that.label2colors = null;
    that.colors = null;

    that.label2name = null;
    that.cluster2name = null;
    that.name = null;

    that.label_cluster = null;
    that.ensemble_preds = null;
    that.learner_preds = null;
    that.N = 0; // label num
    that.n = 0; // cluster num

    that.new2old = null; // mapping from new_cluster to old_cluster after changes
    that.old2new = null; // mapping from old_cluster to new_cluster after changes
    that.clear = function() {
        that.label_cluster = null;
    }
    that.update = function() {
        that._build_colors();
        that._update_preds();
        Matrix.full_update(that.new2old);
        Scatterplot.refresh_color();
    }
    that.get_cluster_from_label = function(label) {
        let cluster = that.label_cluster[label];
        let labels_with_same_cluster = that.get_all_label(cluster)
        let idx = labels_with_same_cluster.indexOf(label);
        return [cluster, idx];
    }
    
    that.origin_get_all_label = cluster =>filter_idx(that.origin_label_cluster, d=>d===cluster);
    that.origin_get_min_label = cluster => that.origin_get_all_label(cluster)[0];
    that.get_all_label = cluster => filter_idx(that.label_cluster, d=>d===cluster);
    that.get_min_label = cluster => that.get_all_label(cluster)[0];
    that.get_id = cluster => that.get_all_label(cluster).join(',')
    that.init = function(label_cluster) {
        that.origin_label_cluster = label_cluster.slice();
        that.origin_open_cluster = [];
        that.label_cluster = label_cluster.slice();
        that.N = label_cluster.length;
        that.unique_cluster = Array.from(new Set(label_cluster));
        that.n = that.unique_cluster.length;
        that.make_color();
        that.update();
    }
    that.make_color = function() {
        let old_cluster2colors = that.cluster2colors;
        that.cluster2colors = [];
        that.cluster2name = [];
        that.label2colors = [];
        if (that.new2old) {
            old_cluster2colors = old_cluster2colors.map(d => HierarchicalColor.indexOf(d));
            for (const [n, old] of Object.entries(that.new2old)) {
                that.cluster2colors[+n] = old_cluster2colors[+old]
              }
        }
        for (let l of that.unique_cluster) {
            that.cluster2name[l] = that.get_all_label(l).map(l => that.label2name[l]).join('\n');

            if (that.cluster2colors[l] !== undefined) continue;
            let cnt = that.label_cluster.filter(x => x === l).length;
            for (let i = 0; i < HierarchicalColor.length; ++i) {
                if (that.cluster2colors.includes(i)) continue;
                if (HierarchicalColor[i].length < cnt) continue;
                that.cluster2colors[l] = i; break;
            }
            if (that.cluster2colors[l] === undefined) console.log("Bad colors");
        }
        that.cluster2colors = that.cluster2colors.map(i => HierarchicalColor[i]);
        for (let i = 0; i < that.N; ++i) {
            let [cluster, idx] = that.get_cluster_from_label(i);
            let colors = that.cluster2colors[cluster];
            let n = that.get_all_label(cluster).length;
            if (n == 1) { that.label2colors[i] = colors[0]; }
            if (n == 2 || n == 3) {
                that.label2colors[i] = idx == 0 ? colors[1] : 
                                        idx == 1 ? colors[0] : colors[2];
            }
            if (n == 4 || n == 5) {
                that.label2colors[i] = idx == 0 ? colors[3] : 
                                        idx == 1 ? colors[1] :
                                        idx == 2 ? colors[0] : 
                                        idx == 3 ? colors[2] : colors[4];
            }
        }
    }

    that._remake_label_cluster = function(label_cluster) {
        ret = [];
        unique_cluster = Array.from(new Set(label_cluster)).sort((x,y)=>(x-y));
        for (let idx = 0; idx < unique_cluster.length; ++idx) {
            let all_idx = filter_idx(label_cluster, d=>d===unique_cluster[idx])
            for (let i of all_idx) ret[i] = idx
        }
        return ret;
    }
    that._build_connection_between_label_cluster = function(old_label_cluster, new_label_cluster) {
        let old_unique_cluster = Array.from(new Set(old_label_cluster)).sort();
        let new_unique_cluster = Array.from(new Set(new_label_cluster)).sort();
        let new2old = {}, old2new = {};
        let used = []
        for (let new_l of new_unique_cluster) {
            let new_idx = filter_idx(new_label_cluster, d => d == new_l);
            let max_sim = 0, max_l = -1;
            for(let old_l of old_unique_cluster) {
                if (used.includes(old_l)) continue;
                let old_idx = filter_idx(old_label_cluster, d => d == old_l);
                let sim = sim_measure_arr(new_idx, old_idx);
                if (sim >= max_sim) {
                    max_sim = sim;
                    max_l = old_l;
                }
            }
            if (max_sim >= 0.5) {
                new2old[new_l] = max_l;
                old2new[max_l] = new_l;
                used.push(max_l);
            }
        }
        return [new2old, old2new];
    }

    that.remake = function(label_cluster) {
        //const opened_old_label = filter_idx(that.label_cluster.map(c => that.get_cluster_type(c)), d => d===1);
        label_cluster = that._remake_label_cluster(label_cluster).slice();
        const old_label_cluster = that.origin_label_cluster.slice();
        const old_open_cluster = that.origin_open_cluster.slice();
        const cluster2colors = that.cluster2colors.slice();
        [that.new2old, that.old2new] = that._build_connection_between_label_cluster(old_label_cluster, label_cluster);
        that.origin_label_cluster = label_cluster.slice();
        that.origin_open_cluster = that.origin_open_cluster.map(old => that.old2new[old]).filter(x => x);
        that.label_cluster = label_cluster.slice();
        that.N = label_cluster.length;
        that.unique_cluster = Array.from(new Set(label_cluster));
        that.n = that.unique_cluster.length;
        that.make_color();
        for (let c of that.origin_open_cluster) {
            const l = that.origin_get_min_label(c);
            that.expand_label(l, false);
        }
        that.update();
        that.new2old = null;
        that.old2new = null;
        Scatterplot.draw_batch_density();
        d3.selectAll("text.additional-object").attr("fill", d => LabelCluster.cluster2colors[LabelCluster.origin_label_cluster[d.label]][3])
        d3.selectAll("text.col-id").attr("fill", d => LabelCluster.get_font_color(d.cluster))
    }



    that.convert_pred = pred => pred.map(x => that.label_cluster[x]);

    that._update_preds = function() {
        that.ensemble_preds = that.convert_pred(Model.ensemble.ensemble_info.pred);
        that.learner_preds = [];
        for (let i = 0; i < Model.ensemble.model_info.length; ++i) {
            that.learner_preds.push(that.convert_pred(Model.ensemble.model_info[i].pred));
        }
    }

    that.get_idx_by_cluster = function (cluster) {
        return filter_idx(that.ensemble_preds, x => x === cluster);
    };


    that.generate_single_cell_info = function(learner, cluster) {
        const labels1 = that.learner_preds[learner];
        const labels2 = that.ensemble_preds;
        return that._mutual_relation(labels1, labels2, cluster);
    }

    that.get_cluster_type = function(cluster) {
        // 0: always single label, 1: expanded single label, 2: multi label
        let num = that.label_cluster.filter(x => x === cluster).length;
        let label = that.label_cluster.indexOf(cluster);
        let origin_cluster = that.origin_label_cluster[label];
        let origin_labels = filter_idx(that.origin_label_cluster, d=> d===origin_cluster);
        let origin_num = origin_labels.length;
        if (origin_num === 1) return 0;
        if (num === 1) return 1;
        return 2;
    }
    that.get_label_type = label => that.get_cluster_type(that.label_cluster[label]);

    that._build_colors = function() {
        that.name = [];
        that.light_color = [];
        that.dark_color = [];
        that.darkest_color = [];
        that.full_color = [];
        that.light_color[-1] = "#e3e3e3"
        that.darkest_color[-1] = "#777777"
        that.dark_color[-1] = "#b3b3b3"
        that.full_color[-1] = "#777777";
        for (let label = 0; label < that.N; ++label) {
            let cluster = that.label_cluster[label];
            let color = null;
            if (that.get_cluster_type(cluster) !== 2) {
                that.name[label] = that.label2name[label];
                color = that.label2colors[label];
            } else {
                let origin_cluster = that.origin_label_cluster[label];
                that.name[label] = that.cluster2name[origin_cluster];
                color = that.cluster2colors[origin_cluster][0];
            }
            [that.dark_color[label], that.light_color[label]] = [color, LightenDarkenColor(color)[1]];
            that.full_color[label] = ColorChangeLight(color, 1);
            that.darkest_color[label] = ColorChangeLight(color, 0.3)
        }
        that.name[-2] = that.name[-1] = "all";
    }
    that.expand_label = function(label, update=true) {
        //while (that.origin_open_cluster.length > 0) {
        //    that.shrink_label(that.origin_label_cluster.indexOf(that.origin_open_cluster[0]), false);
        //}
        that._expand_cluster(that.label_cluster[label], update);
    }
    that._expand_cluster = function(cluster, update=true) {
        let tmp = [];
        let new_cluster = cluster;
        let num = that.label_cluster.filter(x => x === cluster).length;
        if (num === 1) return;
        that.new2old = {};
        that.old2new = {};
        for (let i = 0; i < that.N; ++i) {
            if (that.label_cluster[i] < cluster) {
                tmp[i] = that.label_cluster[i];
            } else if (that.label_cluster[i] > cluster) {
                tmp[i] = that.label_cluster[i] + num - 1;
            } else {
                tmp[i] = new_cluster;
                new_cluster++;
            }
            that.new2old[tmp[i]] = that.label_cluster[i];
            that.old2new[that.label_cluster[i]] = tmp[i];
        }
        that.label_cluster = tmp;
        that.n = Math.max(...tmp) + 1;
        that.origin_open_cluster.push(that.origin_label_cluster[that.get_min_label(cluster)]);
        if (update) that.update();
        that.new2old = null;
        that.old2new = null;
    }
    that.shrink_label = function(label, update=true) {
        that._shrink_cluster(that.label_cluster[label], update);
    }
    that._shrink_cluster = function(cluster, update=true) {
        let tmp = [];
        let label = that.label_cluster.indexOf(cluster);
        let origin_cluster = that.origin_label_cluster[label];
        let origin_labels = filter_idx(that.origin_label_cluster, d=>d===origin_cluster);
        let min_cluster = Math.min(...origin_labels.map(l => that.label_cluster[l]));
        let max_cluster = Math.max(...origin_labels.map(l => that.label_cluster[l]));
        let offset = max_cluster - min_cluster;
        if (offset === 0) return;
        that.new2old = {};
        that.old2new = {};
        for (let i = 0; i < that.N; ++i) {
            if (that.label_cluster[i] < min_cluster) {
                tmp[i] = that.label_cluster[i];
            } else if (that.label_cluster[i] > max_cluster) {
                tmp[i] = that.label_cluster[i] - offset;
            } else {
                tmp[i] = min_cluster;
            }
            that.new2old[tmp[i]] = that.label_cluster[i];
            that.old2new[that.label_cluster[i]] = tmp[i];
        }
        that.label_cluster = tmp;
        that.n = Math.max(...tmp) + 1;
        that.origin_open_cluster.splice(that.origin_open_cluster.indexOf(origin_cluster), 1)
        if (update) that.update();
        that.new2old = null;
        that.old2new = null;
    }

    that.reset = function() {
        that.label_cluster = that.origin_label_cluster.slice();
        that.n = Math.max(...that.label_cluster ) + 1;
        that.origin_open_cluster = [];
    }

    that._mutual_relation = function(labels1, labels2, label) {
        let n_sample = labels1.length;
        if (label !== null) {
            let both_idx = FE(n_sample).filter(i => labels1[i] === label && labels2[i] === label);
            let clf1_idx = FE(n_sample).filter(i => labels1[i] === label && labels2[i] !== label);
            let clf2_idx = FE(n_sample).filter(i => labels1[i] !== label && labels2[i] === label);
            let diff_idx = clf1_idx.concat(clf2_idx);
            return {
                'both': both_idx.length,
                'clf1': clf1_idx.length,
                'clf2': clf2_idx.length,
                'diff': diff_idx.length,
                
                'both_idx': both_idx,
                'clf1_idx': clf1_idx,
                'clf2_idx': clf2_idx,
                'diff_idx': diff_idx,
            }
        } else {
            let same = FE(n_sample).filter(i => labels1[i] === labels2[i]);
            let diff = FE(n_sample).filter(i => labels1[i] !== labels2[i]);
            return {
                'same_idx': same,
                'diff_idx': diff,
                'same': same.length,
                'diff': diff.length,
            }
        }
    }

    that.generate_barchart_info = function(i, j) {
        const learner = LearnerCluster.get_min_learner(i);
        const cluster = j;
        const cell_info = d3.select(`#cell-${learner}-${that.get_min_label(cluster)}`).data()[0].info;
        const labels = filter_idx(that.label_cluster, d=>d===cluster);
        const others = filter_idx(that.label_cluster, d=>d!==cluster);
        const get_margin = (probs) => labels.map(l => probs[l]).max() -  others.map(l => probs[l]).max();
        const get_single_data = ((idx) => [get_margin(Model.ensemble.ensemble_info.probs[idx]), get_margin(Model.ensemble.model_info[learner].probs[idx])])
        if (Highlight.record_source.includes("lasso")) {
            let i = Highlight.record_source.length;
            while ((--i) >= 0) if (Highlight.record_source[i] == "lasso") break;
            const lasso_idx = Highlight.record_highlight_idx[i];
            return [cell_info.both_idx.filter(i => lasso_idx.includes(i)).map(idx => get_single_data(idx)), cell_info.diff_idx.filter(i => lasso_idx.includes(i)).map(idx => get_single_data(idx))]
        }
        //return [cell_info.both_idx.filter(i => Highlight.idx.includes(i)).map(idx => get_single_data(idx)), cell_info.diff_idx.filter(i => Highlight.idx.includes(i)).map(idx => get_single_data(idx))]
        return [cell_info.both_idx.map(idx => get_single_data(idx)), cell_info.diff_idx.map(idx => get_single_data(idx))]
    }

    that.get_width = function(cluster) {
        return that.get_cluster_type(cluster) == 2 ? 150 : 100;
        //return Math.sqrt(that.get_idx_by_cluster(cluster).length) + 100;
    }

    that.get_font_color = function(cluster) {
        const type = that.get_cluster_type(cluster);
        if(type != 1) return 'white';
        const label = that.label_cluster.indexOf(cluster);
        const origin_cluster = that.origin_label_cluster[label];
        const origin_labels = filter_idx(that.origin_label_cluster, d=> d===origin_cluster);
        const idx = origin_labels.indexOf(label);
        if (idx <= 1) return 'white'
        if (origin_labels.length > 3 && idx == 2) return 'white';
        return that.cluster2colors[origin_cluster][3];
    }

    //const HierarchicalColor = [
    //    ["#77D1F3","#519aba"],
    //    ["#FCC32C","#cbcb41"],
    //    ["#AD2323","#e54a3a"],
    //    ["#2A4BD7",],
    //    ["#E574C3",],
    //    ["#E6550D",],
    //    ["#F76C2A","#FD8F3C","#FDBE6B",],
    //    ["#814A19","#7a5650","#ba9b96"],
    //    ["#89BB4C","#31A354","#74C476","#A1D99B",],
    //    ["#AB7EB5","#756BB1","#9E9AC8","#BCBDDC",],
    //    ["#3182BD","#6D93C4","#6BAED6",],
    //    ["#eeeeee","#cccccc","#aaaaaa",],
    //  ];
    const HierarchicalColor = [
        ["#439ef8","#317fce","#92c4fe","#285f98","#dbecff"],
        ["#55c6f7","#399ebe","#99dbf7","#2f779a","#dff4fb"],
        ["#5CC69B","#44ac82","#9be7c7","#358062","#dcf9ed"],
        ["#AACD5A","#97b84b","#d4e8ac","#688035","#eef7d9"],
        ["#EFC33E","#c3a033","#fbdf8e","#967827","#fbf4d9"],
        ["#F49F5C","#c8834d","#f5cca6","#976337","#ffecdc"],
        ["#EA8163","#c26c59","#f4b7a5","#915243","#fde7e5"],
        ["#CC9366","#917866","#e3c4ad","#6b5a4b","#f5ebe4"],
        ["#E87CAC","#c2688d","#f4b5cf","#924e69","#fce5f2"],
        ["#8273fc","#665bcc","#b5aafb","#4e4296","#e2e2fe"],
        ["#3182BD","#2a6fa2","#86badf","#1f547a","#c2dcef"],
    ]
    that.test = function() {
        t = new LabelCluster();
        t.init([0, 1, 2, 3, 4, 4, 0, 5, 3, 6, 7, 6, 8, 6, 9, 3, 3, 7, 0, 7], 
            [8, 16, 3, 15, 1, 14, 12, 18, 6, 0, 2, 19, 17, 10, 9, 11, 13, 4, 5, 7])
        t._expand_cluster(0);
        t._shrink_cluster(0);
        t._expand_cluster(0);
        t._expand_cluster(0);
        t._expand_cluster(5);
        t._shrink_cluster(0);
        t._shrink_cluster(3);
    }
}
