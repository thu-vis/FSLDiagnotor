DataLoaderClass = function () {
  const that = this;

  that.visual_encoding = {
    scatter_color: CategoryColor,
  };

  that.init_url = "/init";
  that.get_data_url = "/get_data";

  that.set_DR_method_url = "/set_DR_method";

  that.get_explain_image_url = "/get_explain_image";
  that.get_influence_url = "/get_influence";
  that.get_learner_influence_url = "/get_learner_influence";
  that.get_all_learner_influence_url = "/get_all_learner_influence";

  that.state = {};
  that.state.current_info = {};
  that.init = function (dataset) {
    that.dataset = dataset;
    LabelCluster.clear();
    LearnerCluster.clear();
    
    AutoInitial = true;
    $("#loading")[0].style.display = "block";
    const node = new request_node(
      that.init_url,
      (data) => {
        $("#loading")[0].style.display = "none";
        d3.select("#matrix svg").html(null)
        d3.selectAll(".additional-object").remove()
        d3.selectAll(".scatter").remove()
        d3.selectAll(".density").remove()
        if (AutoInitial) {
          that.get_data();
        }
        
        that.state.unique_labels = data.unique_labels;
        data.label2name[-1] = "uncertain";
        that.state.label2name = data.label2name;
        LabelCluster.label2name = [];
        for (const [key, value] of Object.entries(data.label2name)) {
          LabelCluster.label2name[key]=value;
        }
        $("#select-labels")
          .html(that.state.unique_labels.map((x) => "<option>" + x + "</option>").join(""))
          .selectpicker("refresh");
      },
      "json",
      "POST"
    );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data({
      dataset: dataset,
    });
    node.notify();
  };

  that.get_data = function () {
    $("#loading")[0].style.display = "block";
    const node = new request_node(
      that.get_data_url,
      (data) => {
        $("#loading")[0].style.display = "none";
        that.state.selected_labels = data.selected_labels;
        that.state.N = data.N;
        that.state.data = [];
        for (let i = 0; i < that.state.N; ++i) {
          that.state.data.push({
            idx: i,
            id: data.ids[i],
            image: data.images[i],
            label: -1,
            gt_label: data.labels[i],
            pred: data.labels[i],
            uncertain_pred: data.labels[i],
            ensemble_pred: data.labels[i],
            ensemble_uncertain_pred: data.labels[i],

            margin_diff: null,
            selected: false,
            recommended: false,
            highlighted: false,
            mouseover: false,
            influence: 1,
            filter_keep: true,
          });
        }
        that.state.first_layer_data = that.state.data;
        Model.generate_model();
      },
      "json",
      "POST"
    );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data({
      seed1: seed1,
      seed2: seed2,
    });
    node.notify();
  };

  that.get_data_onclick = function () {
    that.get_data();
  };

  that.get_influence = function (idx, callback) {
    if (that.influence_data && that.influence_data.idx === idx) {
      callback(that.influence_data);
      return;
    }
    const node = new request_node(that.get_influence_url, callback, "json", "POST");
    node.set_data({
      idx: idx,
      model_id: Model.current_model,
    });
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.notify();
  };

  that.get_learner_influence = function (idx, callback) {
    const node = new request_node(that.get_learner_influence_url, callback, "json", "POST");
    node.set_data({
      model_id: idx,
    });
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.notify();
  };

  that.get_all_learner_influence = function (idx, callback) {
    const node = new request_node(that.get_all_learner_influence_url, callback, "json", "POST");
    node.set_data({
      model_ids: idx,
    });
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.notify();
  };


  that.get_scatterplot_onclick = function () {
    let data = {};
    //for (let key of that.DR_keys) {
    //  data[key] = $(`#slider_${key}`).val();
    //}
    that.get_scatterplot(data);
  };



  that.get_image_base64 = function (id) {
    return `data:image/png;base64,${DataLoader.state.data[id].image}`;
  };

  that.get_explain_image = function (id, hash) {
    return `${that.get_explain_image_url}?id=${id}&hash=${hash}`;
  };

  that.idxes_to_labels_distribution = function (idxes) {
    let distribution = Array(that.state.selected_labels.length).fill(0);
    for (let idx of idxes) distribution[that.state.selected_labels.indexOf(that.state.data[idx].gt_label)] += 1;
    return distribution;
  };

  that.set_data_attr = function (attr, values) {
    //if (attr.includes("pred")) values = LabelCluster.convert_pred(values);
    values.forEach((x, i) => (that.state.data[i][attr] = x));
  };

  that.idx2id = (idx) => that.state.data[idx].id;

  that.get_current_support_set = function () {
    const support_set_idxes = that.state.data.filter((x) => x.selected).map((x) => x.idx);
    const support_set_labels = support_set_idxes.map((i) => that.state.data[i].label);
    let extra_data = [];
    for (let i = -1; i >= -5; --i) if (that.state.data[i] && that.state.data[i].selected) {
      extra_data.push({
        'id': that.state.data[i].id,
        'label': that.state.data[i].label,
        'image': that.state.data[i].image})
      that.state.data[i] = null;
    }
    return [support_set_idxes, support_set_labels, extra_data];
  };

  that.build_base_info = function () {
    that.state.base_info = {
      id: 0,
      pred: that.state.data.map((x) => x.pred),
      margin: that.state.data.map((x) => x.margin),
      probs: that.state.data.map((x) => x.probs),
      display_color: that.state.data.map((x) => x.display_color),
      display_opacity: that.state.data.map((x) => x.display_opacity),
      margin_diff: that.state.data.map((x) => x.margin_diff),
    };
    that.set_data_attr("ensemble_pred", Model.ensemble.ensemble_info.pred);
    that.set_data_attr("ensemble_uncertain_pred", Model.ensemble.ensemble_info.uncertain_pred);
    that.state.current_info = deepCopy(that.state.base_info);
    that.set_info(that.state.base_info);
    that.stack_info = [];
  };

  that.save_info = function (skip_first_layer = false) {
    console.log("save begin");
    if (skip_first_layer) {
      let top_info = that.stack_info.pop();
      that.stack_info.push(deepCopy(that.state.current_info));
      that.stack_info.push(top_info);
    } else {
      that.stack_info.push(deepCopy(that.state.current_info));
    }

    console.log(that.stack_info.map((info) => info.id));
    console.log("save end");
  };

  that.load_info = function (skip_first_layer = false) {
    //console.log("load begin");
    console.log(that.stack_info.map((info) => info.id));
    if (skip_first_layer) {
    } else {
      that.state.current_info = that.stack_info.pop();
    }
    //console.log("load end");
    that._set_info();
  };

  that.set_info = function (d) {
    console.log("set");
    if (d === null) {
      d = that.state.base_info;
    }
    that.state.current_info = deepCopy(d);
    if (!d.display_color) {
      Scatterplot.refresh_color();
      that.state.current_info.display_color = that.state.data.map((x) => x.display_color);
      that.state.current_info.display_opacity = that.state.data.map((x) => x.display_opacity);
    }
    that._set_info();
  };

  that._set_info = function () {
    const info = that.state.current_info;
    if (!info) {console.log("error: no current info)"); return;}
    that.set_data_attr("pred", info.pred);
    that.set_data_attr("margin", info.margin);
    that.set_data_attr("probs", info.probs);
    that.set_data_attr("display_color", info.display_color);
    that.set_data_attr("display_opacity", info.display_opacity);
    that.set_data_attr("margin_diff", info.margin_diff);
  };

  that.highlight = function (idx) {
    //that.save_info();
    Highlight.add_highlight(idx, "temp");
    Scatterplot.refresh_color();
  };

  that.unhighlight = function () {
    //that.load_info();
    Highlight.rm_highlight("temp");
    Scatterplot.refresh_color();
    //Matrix.highlight(Highlight.idx);
  };

  that.select = function (idx, source) {
    //that.save_info();
    //Model.recommend_shot_from_selected(idx)
    Highlight.add_highlight(idx, source);
    Scatterplot.refresh_color();
    //Model.update_table(Highlight.idx);
    //Matrix.highlight(Highlight.idx);
  };
  that.unselect = function (source) {
    //console.log("unselect", DataLoader.state.current_info.highlight_source, source);
    Highlight.rm_highlight(source);
    //if (DataLoader.state.current_info.highlight_source === source) {
    //  that.load_info();
    //}
    Scatterplot.refresh_color();
    if (Highlight.idx && Highlight.type != "temp") {
      Model.update_table(Highlight.idx)
    } else {
      Model.update_table(null)
    }
    //Model.update_table(Highlight.idx);
    //Matrix.highlight(Highlight.idx);
  };
};
