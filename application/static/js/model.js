const ShotStateMode = {
  undecided: -1,
  accept: 0,
  decline: 1,
};

Model = function () {
  const that = this;

  that.models = [];
  that.ensemble = null;
  that.add_model_url =  "/add_model";
  that.recommend_learner_url = "/get_recommend_learner";
  that.recommend_shot_url = "/get_recommend_shot";
  that.recommend_shot_from_selected_url = "/get_recommend_shot_from_selected";
  that.add_similar_url = "/get_similar_data";
  that.adjust_weight_url = "/adjust_weight";

  that.current_model = -1;
  that.current_select_box = null;

  that.updated_table_idx = [];
  that.generate_model = function (num_each_label = 5) {
    that._add_model(null, null, null, null);
  };

  that.update_model = function () {
    let previous_idx = Model.default_idx;
    for (let idx of previous_idx) {
      DataLoader.state.data[idx].card_status = 0
    }
    [support_set_idxes, support_set_labels, extra_data] = DataLoader.get_current_support_set();
    for (let i = 0; i < extra_data.length; ++i) {
      let id = extra_data[i].id
      DataLoader.state.data.push({
        idx: DataLoader.state.N + i,
        id: id,
        image: extra_data[i].image,
        label: extra_data[i].label,
        gt_label: DataLoader.state.all_data[id].gt_label,
        pred: DataLoader.state.all_data[id].pred,
        uncertain_pred: DataLoader.state.all_data[id].pred,
        ensemble_pred: DataLoader.state.all_data[id].pred,
        ensemble_uncertain_pred: DataLoader.state.all_data[id].pred,
        x: DataLoader.state.all_data[id].x,
        y: DataLoader.state.all_data[id].y,

        margin_diff: null,
        selected: true,
        recommended: false,
        highlighted: false,
        mouseover: false,
        influence: 1,
        filter_keep: true,
      });
    }
    DataLoader.state.N = DataLoader.state.data.length;
    //Scatterplot.generate_scatterplot();
    that._add_model(support_set_idxes, support_set_labels, extra_data, Matrix.get_selected_baselearners(), Model.ensemble.clfs_weight);
  };

  that._add_model = function (support_set_idxes, support_set_labels, extra_data, selected_baselearners, clfs_weight) {
    $("#loading")[0].style.display = "block";
    const node = new request_node(
      that.add_model_url,
      (data) => {
        $("#loading")[0].style.display = "none";
        if (that.current_select_box !== null) {
          const [d,g] = that.current_select_box;
          that.on_click(d,g);
        }
        that.calculate_card_layout();
        that.models = [];
        for (let info of data.ensemble.model_info) {
          that.models.push({
            idx: that.models.length,
            support_set_idxes: data.support_set_idxes,
            info: info,
            name: info.name,
            hash: info.hash,
            acc: info.acc,
            pred: info.pred,
            uncertain_pred: info.uncertain_pred,
            margin: info.margin,
          });
        }
        Model.default_idx = data.support_set_idxes;
        data.support_set_idxes.forEach((idx, i) => (DataLoader.state.data[idx].label = data.support_set_labels[i]));
        data.support_set_idxes.forEach((idx, i) => (DataLoader.state.data[idx].selected = true));
        that.ensemble = data.ensemble;
        
        if (!LearnerCluster.learner2cluster) LearnerCluster.init(Model.ensemble);
        if (!LabelCluster.label_cluster) LabelCluster.init(Model.ensemble.label_cluster);
        let ensemble_info = Model.ensemble.ensemble_info;
        DataLoader.state.data.forEach(d => d.card_status = null);
        DataLoader.set_data_attr("pred", ensemble_info.pred);
        DataLoader.set_data_attr("uncertain_pred", ensemble_info.uncertain_pred);
        DataLoader.set_data_attr("ensemble_pred", ensemble_info.pred);
        DataLoader.set_data_attr("ensemble_uncertain_pred", ensemble_info.uncertain_pred);
        DataLoader.set_data_attr("margin", ensemble_info.margin);
        DataLoader.set_data_attr("probs", ensemble_info.probs);
        DataLoader.build_base_info();
        LabelCluster._update_preds();
        Matrix.generate_matrix();
        d3.selectAll(".cluster-glyph").style('opacity', 1)
        d3.selectAll(".line-glyph").style('opacity', 1)
        
        DataLoader.state.data.forEach(
          (d) =>
            (d.confidence_cnt = Model.ensemble.selected_clf_idxes
              .map((idx) => Model.models[idx])
              .map((model) => model.margin[d.idx])
              .filter((x) => x > 0.5).length)
        );
        Scatterplot.learner_filter.noUiSlider.updateOptions({
          range: {
            min: 0,
            max: Model.ensemble.selected_clf_idxes.length,
          },
        });
        Scatterplot.learner_filter.noUiSlider.set([0,Model.ensemble.selected_clf_idxes.length])
        Scatterplot.margin_filter.noUiSlider.set([0,1])

        Highlight.clear();
        Scatterplot.generate_arrow_glyph();

        if (AutoInitial) {
          AutoInitial = false;
          Scatterplot.get_scatterplot();
          begin_tour();
        } else {
          Scatterplot.generate_labels();
          Scatterplot.refresh_color();
        }
        Scatterplot.refresh_arrow();
        for (let d of Matrix.cols) {
          if (!d.selected) Scatterplot.toggle_cluster(LabelCluster.origin_label_cluster[d.label], d.selected);
        }
        Model.update_table();
        //Matrix.highlight();
      },
      "json",
      "POST"
    );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data({
      support_set_idxes: support_set_idxes,
      support_set_labels: support_set_labels,
      selected_baselearners: selected_baselearners,
      clfs_weight: clfs_weight,
      extra_data: extra_data
    });
    node.notify();
  };

  that.recommend_learner = function() {
    $("#loading")[0].style.display = "block";
    let selected_idxes = Scatterplot.scatter_brush
      .selectedItems()
      .data()
      .map((x) => x.idx)

    let node = new request_node(
        that.recommend_learner_url,
        (data) => {$("#loading")[0].style.display = "none";
      
      
      },
        "json",
        "GET"
      );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.notify();
  }

  that.recommend_shot = function () {
    console.log('recommend_shot')
    $("#loading")[0].style.display = "block";
    let selected_idxes = Scatterplot.scatter_brush
      .selectedItems()
      .data()
      .map((x) => x.idx)
    if (selected_idxes.length == 0) selected_idxes = Highlight.idx;
    let node
    if (selected_idxes && selected_idxes.length > 0) {
      node = new request_node(
        that.recommend_shot_from_selected_url,
        (data) => {
          $("#loading")[0].style.display = "none";
          console.log('recommend', data.idx)
          let points = DataLoader.state.data
          for (let i = 0; i < points.length; ++i) {
            if (points[i].card_status == 'Added' || points[i].card_status == 'Removed') {
              points[i].card_status = null
            }
          }
          for (let idx of data.idx) {
            points[idx].card_status = "Added";
          }
          Model.updated_table_idx = [];
          Model.update_table(selected_idxes)
        },
        "json",
        "POST"
      )
      node.set_data({
        idxes: selected_idxes,
      });
    } else {
      node = new request_node(
        that.recommend_shot_url,
        (data) => {
          $("#loading")[0].style.display = "none";
          let previous_idx = Model.default_idx;
          for (let idx of previous_idx) {
            DataLoader.state.data[idx].card_status = null
          }
          Model.default_idx = data.add.concat(data.rm)
          for (let idx of data.add) {
            DataLoader.state.data[idx].card_status = 'Added'
          }
          for (let idx of data.rm) {
            DataLoader.state.data[idx].card_status = 'Removed'
          }
          Model.remove = data.rm;
          //Model.remove_label = Model.remove.map((idx) => DataLoader.state.data[idx].label);
          //Model.remove.forEach((idx) => (DataLoader.state.data[idx].label = -1));
          //Model.remove.forEach((idx) => (DataLoader.state.data[idx].selected = false));
          Model.updated_table_idx = [];
          Model.update_table();
        },
        "json",
        "GET"
      );
    }
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.notify();
  };

  that.add_similar_data = function() {
    $("#loading")[0].style.display = "block";
    let selected_idxes = Highlight.idx;
    if (selected_idxes.length == 0) return;
    const ids = selected_idxes.map(i => DataLoader.state.data[i].id);
    let node = new request_node(
        that.add_similar_url,
        (data) => {
          $("#loading")[0].style.display = "none";
          Highlight.rm_highlight(Highlight.type);
          Scatterplot.refresh_color();
          Matrix.highlight();
          data = data['data']
          data.forEach(d => d.card_status = 'Recommend')
          data.forEach(d => DataLoader.state.data[d.idx] = d);
          that.update_table(data.map(d => d.idx))
        },
        "json",
        "POST"
      );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data({
      ids: ids
    });
    node.notify();
  }

  that.adjust_weight = function(learner_idx, increase) {
    console.log('adjust_weight', learner_idx)
    let selected_idxes = Highlight.idx;
    if (selected_idxes===null || selected_idxes.length == 0) {
      selected_idxes = FE(DataLoader.state.N).filter(i =>
        Model.ensemble.ensemble_info.pred[i] != Model.ensemble.model_info[learner_idx].pred[i]);
    }
    let node = new request_node(
        that.adjust_weight_url,
        (data) => {
          console.log(data['weight']);
          Matrix.all_sliders[learner_idx].noUiSlider.set(+data['weight']);
        },
        "json",
        "POST"
      );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data({
      learner_idx: learner_idx,
      increase: increase,
      sample_idxes: selected_idxes
    });
    node.notify();
  }

  that.generate_card_info = function (idx) {
    return {
      idx: idx,
      label: DataLoader.state.data[idx].label,
      pred: DataLoader.state.data[idx].ensemble_pred,
      uncertain_pred: DataLoader.state.data[idx].ensemble_uncertain_pred,
      probs: DataLoader.state.data[idx].probs,
    };
  };

  that.update_table = function(idx) {
    console.log('request update table', idx)
    clearTimeout(that.table_card_timeout)
    that.table_card_timeout = setTimeout(that._update_table, 100, idx);
    //that._update_table(idx);
  }

  that._update_table = function (idx) {
    if (!DataLoader.state.data[0].probs) return;
    console.log('true update table', idx)
    const L = that.card_layout;
    if (!idx) {
      idx = Model.default_idx;
    }
    if (!set_eq(that.updated_table_idx, idx)) {
      const points = DataLoader.state.data
      idx.sort((x, y) => {
        const a = !!points[x].card_status
        const b = !!points[y].card_status
        const c = points[x].selected;
        const d = points[y].selected;
        const e = points[x].pred;
        const f = points[y].pred;
        if (a != b) {
          return b - a;
        } else if (LabelCluster.label_cluster[d] != LabelCluster.label_cluster[c]) {
          return LabelCluster.label_cluster[d] - LabelCluster.label_cluster[c];
        } else if (d != c) {
          return d - c;
        } else if (LabelCluster.label_cluster[e] != LabelCluster.label_cluster[f]) {
          return LabelCluster.label_cluster[e] - LabelCluster.label_cluster[f]
        } else if (e != f) {
          return e - f
        } else {
          return points[y].probs[f] - points[x].probs[e]
        }
      })
      that.updated_table_idx = idx.slice();
    } else {
      idx = that.updated_table_idx.slice();
      return;
    }
    
    
    const slider_height = L.slider_height;
    const slider_padding = 4.5;
    const slider_width = L.svg_width - 2 * slider_padding;
    const data = idx.map((x) => that.generate_card_info(x))
    const total_card_width = L.card_width * data.length + (L.padding_x * data.length + 1) + 20
    let current_selection =  [0, Math.min(1, 1.0 / data.length * L.n_card) * slider_width]

    const cards_slider = d3.select("#card-slider");
    const cards_view = d3.select("#card-view");
    cards_slider.attr("transform", `translate(${slider_padding}, ${L.card_height + L.padding_y})`);
    cards_slider.selectAll("*").remove()

    cards_slider
      .append("rect")
      .attr("height", slider_height)
      .attr("width", slider_width)
      .attr("fill", "#eee")
      .attr("stroke", "#bbb")
      .attr("stroke-width", "1px")

    let thumbnail_height = slider_height;
    let thumbnail_width = slider_width / data.length;
    let ratio = thumbnail_height / thumbnail_width;
    let k = Math.max(1, Math.round(Math.sqrt(ratio)));
    thumbnail_height /= k;
    thumbnail_width *= k;

    const cards_slider_images =
      cards_slider.selectAll(".thumbnail")
        .data(data, (d) => d.idx).enter()
        .append("image")
        .attr("class", "thumbnail")
        .attr("xlink:href", (d) => DataLoader.get_image_base64(d.idx))
        .attr("width", thumbnail_width)
        .attr("height", thumbnail_height)
        .attr("x", (d, i) => slider_width / data.length * k * Math.floor(i / k))
        .attr("y", (d, i) => (i%k) * thumbnail_height)
    
    const brushSelection = (selection) => {
      cards_view.attr("transform", `translate(${-selection[0] / slider_width * total_card_width}, 0)`)
      cards_slider_images
      .style("opacity", (d, i) => {
        let x1 = slider_width / data.length * i
        let x2 = slider_width / data.length * (i + 1)
        return (x1 >= selection[0] && x2 <= selection[1]) ? 1 : 0.2
      })
    }

    const brush = d3.brushX()
      .extent([[0, 0], [slider_width, slider_height]])
      .on("brush", function(){
        that.current_selection = current_selection = d3.event.selection
        brushSelection(current_selection)
      })


    cards_slider.append("g")
        .call(brush)
        .call(brush.move, current_selection)
        .call(g => g.select(".overlay")
            .datum({type: "selection"})
            .on("mousedown touchstart", beforebrushstarted));

    cards_slider.selectAll('.handle').remove()
    cards_slider.selectAll('.selection')
      .attr("fill-opacity", 0)

    function beforebrushstarted(event) {
      const dx = current_selection[1] - current_selection[0]
      const cx = d3.event.offsetX
      const [x0, x1] = [cx - dx / 2, cx + dx / 2]
      const [X0, X1] = [0, total_card_width - L.svg_width]
      let start_X = x1 > X1 ? X1 - dx : x0 < X0 ? X0 : x0;
      const unit = slider_width / data.length;
      const n = Math.ceil(start_X / unit);
      start_X = (n * L.card_width + (n+1) * L.padding_x) / total_card_width * slider_width;
      d3.select(this.parentNode)
        .call(brush.move, [start_X,start_X+dx]);
    }

    cards_slider_images
      .style("opacity", (d, i) => {
        let x1 = slider_width / data.length * i
        let x2 = slider_width / data.length * (i + 1)
        return (x1 >= current_selection[0] && x2 <= current_selection[1]) ? 1 : 0.2
      })

        
    const cards = cards_view
      .selectAll(".shot-card")
      .data(data, (d) => d.idx)
    
    that.options_html = LabelCluster.label2name.map(l => `<option value="${l}">${l}</option>`).join('')
    cards.exit().transition().duration(Animation.exit).remove();
    cards
      .enter()
      .append("g")
      .attr("id", (d) => `card-${d.idx}`)
      .classed("shot-card", true)
      .merge(cards)
      .transition()
      .duration(Animation.update)
      .attr("transform", (d, i) => `translate(${i * (L.card_width + L.padding_x) + 5},${5})`)
      .each(that.fill_card);
    
    $(".selectpicker").on('shown.bs.select',function(e){
      d3.selectAll(".dropdown-space").style("pointer-events", "all")
      d3.selectAll(".bar").style("pointer-events", "none")
      d3.selectAll(".card-radio").style("pointer-events", "none")
      d3.selectAll(".card-info").style("pointer-events", "none")
    })
    $(".selectpicker").on('hidden.bs.select',function(e){
      console.log('收起');
      d3.selectAll(".dropdown-space").style("pointer-events", "none")
      d3.selectAll(".bar").style("pointer-events", "auto")
      d3.selectAll(".card-radio").style("pointer-events", "auto")
      d3.selectAll(".card-info").style("pointer-events", "auto")
    });
    Scatterplot._refresh_color();
  };

  that.calculate_card_layout = function() {
    if (that.card_layout) return;
    that.card_layout = {}
    const L = that.card_layout;
    const div = d3.select("#model-row");
    L.div_width = div.node().getBoundingClientRect().width;
    L.div_height = div.node().getBoundingClientRect().height;
    d3.select("#shot-cards-div").style("width", `${L.div_width}px`).style("height", `${L.div_height}px`);
    L.div_margin = {left: 10, right: 10, top: 10, bottom: 0 };
    L.nrow = 6;
    L.svg_width = L.div_width - L.div_margin.left - L.div_margin.right;
    L.svg_height = L.div_height - L.div_margin.top - L.div_margin.bottom;
    L.slider_height = 30;
    L.padding_x = 10;
    L.padding_y = 6;
    L.n_card = 4.1;
    L.card_width = (L.svg_width - (L.n_card - 1) * L.padding_x) / L.n_card;
    L.card_height = L.svg_height - L.padding_y - L.slider_height;
    d3.select("#shot-cards").attr("width", L.svg_width).attr("height", L.svg_height)
      .attr("transform", `translate(${L.div_margin.left},${L.div_margin.top})`)
    d3.select("#card-slider").attr("transform", `translate(${4}, ${L.card_height + L.padding_y})`)
    L.border_width = 4;
    L.img_width = (L.card_width - 2 * L.border_width)
    L.img_y_offset = 6
    L.bar_width = 0.75 * L.img_width;
    L.full_bar_height = (L.card_height - L.card_width) / L.nrow,
    L.font_size = L.full_bar_height * 0.6;
    L.bar_height_padding_each = 0.05;
    L.bar_height = L.full_bar_height * (1 - 2 * L.bar_height_padding_each);
    L.bar_padding_top = Math.max(0, (L.card_height - L.card_width - L.full_bar_height * L.nrow) / 2)
    L.info_y_offset = L.img_width + L.img_y_offset;
    L.rect_border_color = "#b9bac6";
    L.darker_border_color = "#72758d"
    L.rect_selected_border_color = '#b94b4c'
    L.card_bg_color = "#ededf3"
    L.close_size = 8
    L.hint_text_size = L.font_size
    L.center_offset = (0.5 - L.bar_height_padding_each) * L.full_bar_height;
    L.cbox_size = L.full_bar_height * 0.6;
    L.cbox_yoffset = L.full_bar_height * 0.15;
    L.check_xscale = L.cbox_size / 1750;
    L.check_yscale = L.cbox_size / 1350;
  }

  that._generate_bars = function(g, info, selected_labels) {
    const L = that.card_layout;
    const bars = g.selectAll("g.bar").data(selected_labels, d=>d.i);
    bars.exit().remove();
    const bars_enter = bars.enter().append("g")
      .attr("class", (d,i) => `bar bar-${i}`)
      .merge(bars)
      .attr("transform", (d,i) => `translate(0,${(i + L.bar_height_padding_each) * L.full_bar_height + L.bar_padding_top})`)
    bars_enter
      .append("rect")
      .classed("gray-bar", true)
      .attr("width", L.bar_width)
      .attr("height", L.bar_height)
      //.attr("rx", L.bar_height / 2)
      //.attr("ry", L.bar_height / 2)
      .attr("fill", "#ffffff");
    bars_enter
      .append("rect")
      .classed("color-bar", true)
      .attr("width", (d) => d.val * L.bar_width)
      .attr("height", L.bar_height)
      //.attr("clip-path", (d, i) => `url(#color-bar-clip)`)
      .attr("fill", (d, i) => LabelCluster.light_color[d.i]);
    bars_enter
      .append("text")
      .classed("label-name", true)
      .text(d => LabelCluster.label2name[d.i].substring(0, 12))
      .attr("font-weight",d => d.i === info.label ? "bold" : "normal")
      .attr("text-anchor", "start")
      .attr("x", 4)
      .attr("y", L.center_offset)
      .attr("dy", "0.4em")
      .attr("font-size", L.font_size);
    bars.selectAll(".label-name").text(d => LabelCluster.label2name[d.i].substring(0, 12))
      .attr("font-weight", d => d.i === info.label ? "bold" : "normal")

    bars_enter
      .append("rect")
      .classed("card-radio", true)
      .attr("height", L.cbox_size)
      .attr("width", L.cbox_size)
      .attr("rx", 1)
      .attr("ry", 1)
      .attr("x", L.img_width - L.cbox_size)
      .attr("y", L.cbox_yoffset)
      .attr("fill", (d) => (d.i === info.label ? LabelCluster.dark_color[info.label] : CHECK_FILL[0]))
      .attr("stroke", (d) => (d.i === info.label ? LabelCluster.dark_color[info.label] : CHECK_STROKE[0]))
      .attr("stroke-width", 1)
      .on("click", function (d, i) {
        info.label = d.i === info.label ? -1 : d.i;
        g.selectAll(".card-radio-glyph").attr("fill-opacity", d => d.i === info.label ? 1 : 0);
        g.selectAll(".card-radio")
          .attr("fill", (d, i) => (d.i === info.label ? LabelCluster.dark_color[info.label] : CHECK_FILL[0]))
          .attr("stroke", (d) => (d.i === info.label ? LabelCluster.dark_color[info.label] : CHECK_STROKE[0]));
        //d3.select(`#scatter-${info.idx}`).attr("d", info.label === -1 ? CIRCLE_6 : STAR_6)
        //  .style("fill", info.label === -1 ? info.color : LabelCluster.dark_color[info.label]);
        g.selectAll(".label-name").attr("font-weight", d => d.i === info.label ? "bold" : "normal")
        let current_info = DataLoader.state.current_info;
        let data = DataLoader.state.data[info.idx];
        if (info.label !== -1) {
          data.selected = true;
          data.label = info.label;
          //data.pred = info.label;
          data.display = info.label;
          data.display_color = LabelCluster.dark_color[data.display];
          current_info.pred[info.idx] = info.label;
          const t = d3.select(`#shot-glyph-${info.idx}`)
            .attr("fill", LabelCluster.dark_color[info.label])
            .attr("opacity", 1)
        } else {
          data.selected = false;
          data.label = -1;
          //data.pred = current_info.pred[info.idx];
          const attr = Scatterplot.show_uncertain ? "uncertain_pred" : "pred";
          data.display = d[attr];
          data.display_color = LabelCluster.dark_color[data.display];
          d3.select(`#shot-glyph-${info.idx}`).attr("opacity", 0);
        }
        Scatterplot._refresh_color();
      });
    bars.selectAll(".card-radio").attr("fill", (d) => (d.i === info.label ? LabelCluster.dark_color[info.label] : "#f6f6f6"))
      
    bars_enter
      .append("path")
      .classed("card-radio-glyph", true)
      .classed("check-glyph", true)
      .attr("d", CHECK)
      .attr("fill", "white")
      .attr("fill-opacity", d => d.i === info.label ? 1 : 0)
      .attr("transform", `translate(${L.img_width - L.cbox_size * 0.9}, ${L.cbox_yoffset + L.cbox_size/10}) scale(${L.check_xscale},${L.check_yscale})`);  
    bars.selectAll(".card-radio-glyph").attr("fill-opacity", d => d.i === info.label ? 1 : 0)
  }
  that.fill_card = function (d) {
    const info = d;
    const L = that.card_layout;
    const g = d3.select(`g#card-${info.idx}`);
    let selected_labels = info.probs.map((val,i) =>({'val': val, 'i':i}))
                                  .sort((x,y)=>y.val-x.val)
                                  .slice(0,L.nrow - 1);
    if (DataLoader.state.data[info.idx].selected && !selected_labels.map(d => d.i).includes(info.label)) {
      selected_labels.unshift({'val': info.probs[info.label], 'i': info.label});
      selected_labels.pop();
    }
    g
    .on("mouseover", that.card_on_mouseover)
    .on("mouseout", that.card_on_mouseout)
    g.html(null);
    g.append("rect")
      .attr("class", "card-bg")
      .attr("y", L.border_width)
      .attr("height", L.card_height - L.border_width - 5)
      .attr("width", L.card_width)
      .attr("fill", L.card_bg_color)
      .attr("stroke", L.darker_border_color)
      .attr("stroke-width", 0)
    const close_area = g
      .append("g")
      .classed("card-close", true)
      .attr("transform", `translate(${L.card_width - L.close_size - 2},${L.border_width})`)
      .style("opacity", 0)
      
    const points = DataLoader.state.data
    if (!!points[info.idx].card_status) {
      const hint_area = g
      .append("g")
      .classed("card-hint", true)
      .attr("transform", `translate(${L.close_size + 5},${L.border_width})`)
      const hint_bg = hint_area
      .append("rect")
      .attr("x", -2)
      .attr("y", -1)
      .attr("width", () => {
        if (points[info.idx].card_status == 'Added') {
          return L.close_size * 4.2
        } else if (points[info.idx].card_status == 'Removed') {
          return L.close_size * 6
        } else if (points[info.idx].card_status == 'Recommend') {
          return L.close_size * 7.5
        } 
      })
      .attr("height", L.close_size + 2)
      .attr("fill", L.card_bg_color)
      .attr("stroke", "none")
    const hint_text = hint_area
      .append("text")
      .attr("dy", L.hint_text_size / 2)
      .attr("font-size", `${L.hint_text_size}px`)
      .attr("font-family", "Arial")
      .text(points[info.idx].card_status)
    }


     g.append("path")
      .classed("card-shot-glyph", true)
      .attr("id", `shot-glyph-${info.idx}`)
      .attr("d", STAR_4)
      .attr("transform", "translate(5,5)")
      .attr("fill", LabelCluster.dark_color[info.label])
      .attr("opacity",points[info.idx].selected ? 1 : 0)


    close_area
      .on("mouseover", function(d) {
        d3.select(this).select("circle").attr("fill", L.darker_border_color)
      })
      .on("mouseout", function(d) {
        d3.select(this).select("circle").attr("fill", L.rect_border_color)
      })
      .on("click", function(d) {
        let idx = that.updated_table_idx
        let new_idx = idx.filter(e => e != info.idx)
        that.update_table(new_idx)
        let current_info = DataLoader.state.current_info;
        if (info.label !== -1) {
          DataLoader.state.data[info.idx].selected = false;
          DataLoader.state.data[info.idx].label = -1;
          //DataLoader.state.data[info.idx].pred = current_info.old_pred[info.idx];
          //current_info.pred[info.idx] = current_info.old_pred[info.idx];
        }
      })
    
    close_area
      .append("circle")
      .attr("r", L.close_size)
      .attr("fill", L.rect_border_color)
      .attr("stroke", "none")
    
    close_area
      .append("line")
      .attr("x1", -L.close_size * 0.5)
      .attr("y1", -L.close_size * 0.5)
      .attr("x2", L.close_size * 0.5)
      .attr("y2", L.close_size * 0.5)
      .attr("stroke-width", "3px")
      .attr("stroke", "white")
    
    close_area
      .append("line")
      .attr("x1", -L.close_size * 0.5)
      .attr("y1", L.close_size * 0.5)
      .attr("x2", L.close_size * 0.5)
      .attr("y2", -L.close_size * 0.5)
      .attr("stroke-width", "3px")
      .attr("stroke", "white")


    const img_area = g
      .append("g")
      .classed("card-image", true)
      .attr("transform", `translate(${L.border_width},${L.img_y_offset})`);
    const info_area = g
      .append("g")
      .classed("card-info", true)
      .attr("transform", `translate(${L.border_width},${L.info_y_offset})`);
  
      img_area
        .append("rect")
        .attr("width", L.img_width * 0.8)
        .attr("height", L.img_width * 0.8)
        .attr("x", L.img_width * 0.1)
        .attr("y", L.img_width * 0.1)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", "1.5px")
      const img = img_area.selectAll("image").data([info]);
      img
        .enter()
        .append("image")
        .merge(img)
        .attr("xlink:href", DataLoader.get_image_base64(info.idx))
        .attr("width", L.img_width * 0.8)
        .attr("height", L.img_width * 0.8)
        .attr("x", L.img_width * 0.1)
        .attr("y", L.img_width * 0.1)

      that._generate_bars(info_area, info, selected_labels);
      const foreign_object = info_area.append('foreignObject')
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", L.nrow * L.full_bar_height)
        .attr("width", L.card_width)
        .attr("class", "selectionbox")
        .append("xhtml:div")
        
      foreign_object.append('div')
        .attr("class", "dropdown-space")
        .style("height", `${(L.nrow-1) * L.full_bar_height}px`)
        .style("pointer-events", "none")
      const select = foreign_object.append("select")
            .attr("class", "selectpicker selectlabel")
            .attr("data-size", 4)
            .attr("id", `select-input-${info.idx}`)
            .attr("data-width", `${L.img_width}px`)
            .attr("data-selected-text-format", "static")
            .attr("title", "others...")
            .html(that.options_html)
    $(`#select-input-${info.idx}`).selectpicker('val', LabelCluster.label2name[selected_labels[0].i]);
    
    $(`#select-input-${info.idx}`).on('changed.bs.select',function(event, label, isSelected, previousValue){
      label -= 1;
      let idx = selected_labels.findIndex(x => x.i === label);
      if (idx === -1) {
        selected_labels.pop();
        selected_labels.unshift({'val': info.probs[label], 'i': label})
      }
      info.label = label;
      DataLoader.state.data[info.idx].selected = true;
      DataLoader.state.data[info.idx].label = info.label;
      DataLoader.state.data[info.idx].pred = info.label;
      DataLoader.state.current_info.pred[info.idx] = info.label;
      d3.select(`#scatter-${info.idx}`).attr("d", info.label === -1 ? CIRCLE_6 : STAR_6)
      .style("fill", info.label === -1 ? info.color : LabelCluster.dark_color[info.label]);
      const t = d3.select(`#shot-glyph-${info.idx}`)
        .attr("fill", LabelCluster.dark_color[info.label])
        .attr("opacity", 1)
      that._generate_bars(info_area, info, selected_labels);
    })
  };
  that.shot_timer = -1
  that.shot_timer_2 = -1
  that.card_on_mouseover = function (d) {
    console.log("card enter: ", d.idx, LabelCluster.label2name[DataLoader.state.data[d.idx].gt_label], that.shot_timer, that.shot_timer_2);
    d3.select(`#scatter-${d.idx}`).attr("d", d => d.selected ? STAR_6 : CIRCLE_6).raise();
    d3.select(this).select(".card-close").style("opacity", 1);
    d3.select(this).select(".card-bg").attr("stroke-width", "2px")
    if (d.idx < 0) return;
    if (that.shot_timer_2 != -1) {
      //DataLoader.load_info();
      clearTimeout(that.shot_timer_2);
      that.shot_timer_2 = -1;
    }
    clearTimeout(that.shot_timer);
    //that.shot_timer = setTimeout(() => {
      Scatterplot.mouseover_state = d.idx;
      DataLoader.get_influence(d.idx, (data) => {
        if (Scatterplot.mouseover_state !== d.idx) return;
        Scatterplot.mouseover_state = -2 - d.idx;
        DataLoader.influence_data = data;
        DataLoader.save_info();
        const opacity = Scatterplot.calculate_opacity_based_on_influence(d.idx);
        DataLoader.state.data[d.idx].mouseover = true;
        DataLoader.set_data_attr("display_opacity", opacity);
        Scatterplot._refresh_color();
        that.shot_timer = -1;
      });
    //}, 200)
  };

  that.card_on_mouseout = function (d) {
    //console.log("card out: ", d.idx, that.shot_timer, that.shot_timer_2);
    d3.select(`#scatter-${d.idx}`).attr("d", d => d.selected ? STAR_4 : CIRCLE_4).raise();
    d3.select(this).select(".card-close").style("opacity", 0);
    d3.select(this).select(".card-bg").attr("stroke-width", "0px")
    if (d.idx < 0) return;
    if (that.shot_timer != -1) {
      //DataLoader.load_info();
      clearTimeout(that.shot_timer);
      that.shot_timer = -1;
    }
    clearTimeout(that.shot_timer_2);
    //that.shot_timer_2 = setTimeout(() => {
      //console.log("shot on mouse out");
      //console.log(Scatterplot.mouseover_state);
      if (Scatterplot.mouseover_state === -1) return;
      if (Scatterplot.mouseover_state < -1) {
        DataLoader.load_info();
        Scatterplot.refresh_color();
      }
      Scatterplot.mouseover_state = -1;
      DataLoader.state.data[d.idx].mouseover = false;
      that.shot_timer_2 = -1;
    //}, 200)
  };

  that.show_learner_diff = function (model1 = null, model2 = null) {
    const margin_thres = 0.25;
    if (model1 === null) model1 = that.current_select_box[0].info;
    if (model2 === null) model2 = Model.ensemble.ensemble_info;
    DataLoader.state.data.forEach((d, i) => (d.display = model1.margin[i] > margin_thres ? model1.pred[i] : -1));
    DataLoader.state.data.forEach(
      (d) =>
        (d.display_color =
          d.selected || d.highlighted ? LabelCluster.dark_color[d.display] : LabelCluster.dark_color[d.display])
    );
    DataLoader.state.data.forEach(
      (d, i) =>
        (d.display_opacity =
          model1.pred[i] === model2.pred[i]
            ? 0.1
            : model1.margin[i] < model2.margin[i]
            ? 0.1
            : 0.2 + (model1.margin[i] - model2.margin[i]) * 2)
    );
    Scatterplot._refresh_color();
  };

  that.on_mouseover = function (d) {
    console.log("model.on_mouseover", d.learner, Matrix.current_highlight_row, Matrix.row_mouseover_state);
    if (Matrix.current_highlight_row.length === 1 && Matrix.current_highlight_row[0] == d.i) return;
    
    Matrix.row_mouseover_state = d.learner;
    Matrix.current_highlight_row.union(d.i);
    Matrix._draw_highlight_strip_row();
      DataLoader.get_learner_influence(d.learner, (data) => {
        if (Matrix.row_mouseover_state !== d.learner) return;
        //console.log("get_influence", d.learner);
        clearTimeout(that.scatter_timer)
        that.scatter_timer = setTimeout(() => {
          //console.log("set_influence", d.learner);
          Matrix.row_mouseover_state = -2 - d.learner;
          that.learner_influence_data = data;
          if (!that.info_saved) {
            that.info_saved = 1
            DataLoader.save_info();
          }
          //console.log("learner influence", data);
          DataLoader.state.current_info.margin_diff = data.margin_diff;
          DataLoader.set_data_attr("margin_diff", data.margin_diff);
          DataLoader.set_data_attr("old_pred", data.old_pred);
          DataLoader.set_data_attr("new_pred", data.new_pred);
          DataLoader.set_data_attr("old_uncertain_pred", data.old_uncertain_pred);
          DataLoader.set_data_attr("new_uncertain_pred", data.new_uncertain_pred);
          Scatterplot.refresh_color();
        }, 200)
        console.log('set timeout', that.scatter_timer)
      })
  };

  that.on_mouseout = function (d) {
    console.log("model.on_mouseout", d.i, Matrix.current_highlight_row, Matrix.row_mouseover_state);
    Matrix.current_highlight_row.remove(d.i);
    if (that.current_select_box !== null) {
      Matrix.current_highlight_row.union(that.current_select_box[0].i);
    }
    Matrix._draw_highlight_strip_row();
    if (Matrix.row_mouseover_state === -1) return;
    if (Matrix.row_mouseover_state >= 0) {
      
      console.log('clear timeout', that.scatter_timer);
       clearTimeout(that.scatter_timer); 
       Matrix.row_mouseover_state = -1;
       return;
    }
    
      if (Matrix.row_mouseover_state < -1) {
        clearTimeout(that.scatter_timer)
        //that.scatter_timer = setTimeout(() => {
          console.log("remove density", d.i)
          if (that.info_saved) {
            that.info_saved = 0
            DataLoader.load_info();
          }
          Scatterplot.refresh_color();
       // }, 200)
      }
      Matrix.row_mouseover_state = -1;
  };

  that.on_click = function (d, g) {
    console.log("model.on_click");
    if (that.current_select_box !== null) {
      if (d.focus) {
        that.current_select_box = null;
        d.focus = false;
        g.attr("stroke-width", 1);
        DataLoader.load_info();
        Scatterplot.refresh_color();
        Matrix.current_highlight_row = [];
      } else {
        [other_d, other_g] = that.current_select_box;
        other_d.focus = false;
        other_g.attr("stroke-width", 1);
        that.current_select_box = [d, g];
        d.focus = true;
        DataLoader.stack_info.pop();
        DataLoader.save_info();
        Matrix.current_highlight_row = [d.i];
      }
    } else {
      that.current_select_box = [d, g];
      d.focus = true;
      DataLoader.save_info();
      Matrix.current_highlight_row = [d.i];
    }
    Matrix._draw_highlight_strip_row();
  };

  that.id2name = function (id) {
    //const name = Model.models[id].name;
    const name = Model.models[id].name.replace('mini', 'mini ');
    if (name.indexOf("res12") === -1) return "BL-" + name.replace("_", "").replace("-film", "");
    return "BL-" + name.substr(6);
  };
  that.id2name_part1 = function (id) {
    return "BL-" + Model.models[id].name.replace('_','').split('-').join('');
  };
};
