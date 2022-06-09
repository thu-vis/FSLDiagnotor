const ColorMode = {
  coverage: 0,
  margin: 1,
  label: 2,
  pred: 3,
  diff: 4,
  coverage_uncertain: 5,
  margin_uncertain: 6,
  pred_diff: 7,
};
Object.freeze(ColorMode);

Scatterplot = function () {
  const discard_opacity = 0.05;
  const keep_opacity_min = 0.3;
  const keep_opacity_coef = 1 - keep_opacity_min;
  const that = this;

  const tooltip_height = 80;
  const tooltip_width = tooltip_height;
  that.color_mode = 6;
  that.explain = false;
  that.mouseover_state = -1;
  that.hover_activate = true;

  that.div = d3.select("#scatterplot");
  that.progress = that.div.select("svg#progress");
  that.svg = that.div.select("svg#plot");
  that.defs = that.svg.append("defs");
  that.show_uncertain = true;

  const tooltip = d3.select("#scatterplot")
                    .append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("width", tooltip_width)
                    .style("height", tooltip_height)
                    .style("pointer-events", "none");
  const div_margin = {
    left: 5,
    right: 5,
    top: 20,
    bottom: 0,
  };
  const plot_margin = {
    left: 10,
    right: 10,
    top: 5,
    bottom: 0,
  };

  that.width = 0;
  that.height = 0;

  that.get_scatterplot_url = "/get_scatterplot";
  that.zoom_in_url = "/zoomin"

  that.get_scatterplot = function () {
    $("#loading")[0].style.display = "block";
    //that.progress.html(null)
    //that.svg.html(null)
    const node = new request_node(
      that.get_scatterplot_url,
      (data) => {
        $("#loading")[0].style.display = "none";
        $("#sample-controls")[0].style.opacity = 1;
        Scatterplot.initialized = true;
        DataLoader.state.data.forEach((d, i) => {d.x = data.x[i]; d.y = data.y[i];})
        DataLoader.state.all_data = data.all_pred.map((d,i) => ({
          id: i,
          x: data.all_x[i],
          y: data.all_y[i],
          pred: data.all_pred[i],
          gt_label: data.all_label[i],
          each_pred: data.each_pred[i],
        }))
        Scatterplot.generate_scatterplot();
        
        Scatterplot.generate_labels();
        Scatterplot.refresh_arrow();
        Model.update_table();
      },
      "json",
      "GET"
    );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data();
    node.notify();
  };


  that.draw_density = function (key, data, color) {
    const density = d3
      .contourDensity()
      .x((d) => d.coord_x)
      .y((d) => d.coord_y)
      .size([that.width, that.height])
      .thresholds(DataLoader.dataset == 'cifar' ? [1] : [0.15])
      .bandwidth(20)(data);
    for (let i = 0; i < density.length; ++i) {
      density[i].color = color;
      density[i].opacity = 0.1;
      density[i].is_first = i == 0;
      density[i].key = key;
      density[i].cluster = key;
    }
    that.density_labels.push([key, color]);
    that.densities = [...that.densities, ...density.slice(0, 1)];
  };

  that.draw_batch_density = function (duration = 500, delay = 500) {
    delay = delay || 0;
    that.densities = [];
    that.density_labels = [];
    const [x,y] = that.xyscale;
    const n_cluster = Array.from(new Set(LabelCluster.origin_label_cluster)).length;
    for(let cluster = 0; cluster < n_cluster; ++cluster) {
      const data = DataLoader.state.all_data
        .filter(d => LabelCluster.origin_label_cluster[d.pred] === cluster)
        .map(d => ({coord_x: x(d.x), coord_y: y(d.y)}))
      const color = LabelCluster.cluster2colors[cluster][0]
      that.draw_density(cluster, data, color);
    }

    let polygons = [];
    that.densities.forEach((density) => {
      density.coordinates.forEach((polygon, idInDensity) => {
        polygons.push({
          density,
          index: idInDensity,
        });
      });
    });
    console.log("densities", that.densities);

    polygons.forEach((p) => {
      p.renderData = Object.assign({}, p.density);
      p.renderData.coordinates = [p.density.coordinates[p.index]];
    });

    let svg = that.svg.select("#plot-background");
    let slc = svg.selectAll(".density").data(polygons, function (d) {
      return "" + d.density.key + "_" + d.density.opacity.toFixed(3) + "_" + d.index;
    });

    slc.exit().remove();

    let slcEnter = slc
      .enter()
      .append("path")
      .classed("density", true)
      .attr("component", (d) => d.density.key)
      .style("pointer-events", "none");

    slcEnter = slcEnter
      .style("opacity", 0)
      .attr("fill-opacity", (d) => d.renderData.opacity)
      .attr("fill", (d) => d.renderData.color)
      .attr("d", (d) => d3.geoPath()(d.renderData))
      .transition()
      .delay(delay)
      .duration(duration)
      .style("opacity", 1);

    slc.attr("fill-opacity", (d) => d.renderData.opacity)
      .attr("fill", (d) => d.renderData.color)
      .attr("d", (d) => d3.geoPath()(d.renderData));
  };

  that.toggle_uncertain_mode = function() {
    that.show_uncertain = !that.show_uncertain;
    that._set_color_label();
    that._refresh_color();
    d3.select('#uncertain-mode')
    .attr("fill", that.show_uncertain ? CHECK_FILL[2] : CHECK_FILL[0])
    .attr("stroke", that.show_uncertain ? CHECK_STROKE[2] : CHECK_STROKE[0])
    d3.select('#uncertain-check').attr("fill-opacity", that.show_uncertain ? 1 : 0);
  }

  that.generate_scatterplot = function () {
    d3.select("#uncertain-mode-svg").on("click", that.toggle_uncertain_mode);
    d3.select('#uncertain-mode')
    .attr("fill", that.show_uncertain ? CHECK_FILL[2] : CHECK_FILL[0])
    .attr("stroke", that.show_uncertain ? CHECK_STROKE[2] : CHECK_STROKE[0])
    d3.select('#uncertain-check').attr("fill-opacity", that.show_uncertain ? 1 : 0);
    d3.selectAll('.scatter').remove()
    d3.selectAll('.additional-object').remove()
    d3.selectAll('.density').remove()
    const svg_width = that.div.node().getBoundingClientRect().width - div_margin.left - div_margin.right - 20;
    const total_height = that.div.node().getBoundingClientRect().height - div_margin.top - div_margin.bottom;
    const progress_svg_height = 0.0 * total_height;
    const svg_height = total_height - progress_svg_height;
    that.svg
      .attr("width", svg_width)
      .attr("height", svg_height)
      .attr("transform", `translate(${div_margin.left},${10})`);

    that.width = parseInt(svg_width) - plot_margin.left - plot_margin.right;
    that.height = parseInt(svg_height) - plot_margin.top - plot_margin.bottom;

    const current_x = DataLoader.state.data.map((d) => d.x);
    const current_y = DataLoader.state.data.map((d) => d.y);

    let scatter_region = {};
    scatter_region.xmin = Math.floor(Math.min(...current_x));
    scatter_region.xmax = Math.ceil(Math.max(...current_x));
    scatter_region.ymin = Math.floor(Math.min(...current_y));
    scatter_region.ymax = Math.ceil(Math.max(...current_y));

    const x = d3
      .scaleLinear()
      .domain([scatter_region.xmin, scatter_region.xmax])
      .range([plot_margin.left, plot_margin.left + that.width]);
    const y = d3
      .scaleLinear()
      .domain([scatter_region.ymin, scatter_region.ymax])
      .range([plot_margin.top + that.height, plot_margin.top]);
    DataLoader.state.data.forEach((d) => (d.coord_x = x(d.x)));
    DataLoader.state.data.forEach((d) => (d.coord_y = y(d.y)));
    that.xyscale = [x, y];

    const nodeSlc1 = that.svg
      .select("#plot-scatter")
      .select(".normal")
      .selectAll(".scatter")
      .data(DataLoader.state.data, (d) => d.id);
    nodeSlc1
      .enter()
      .append("path")
      .classed("scatter", true)
      .classed("show", d => true)
      .classed("hide", d => false)
      .attr("d", d3.symbol().type(d3.symbols[0]).size(5))
      .attr("id", (d) => `scatter-${d.idx}`)
      .attr("transform", d => `translate(${d.coord_x},${d.coord_y})`)
      .on("mouseover", that.sample_on_mouseover)
      .on("mouseout", that.sample_on_mouseout)
      .on("click", that.sample_on_click)
      
    that.div_rect = document.getElementById("plot").getBoundingClientRect();
    that.init_lasso();
    that.refresh_color();
    that.draw_batch_density();
  };

  that.calculate_opacity_based_on_influence = function (idx) {
    const d = DataLoader.state.data[idx];
    if (true) {
      const delta_margin = DataLoader.influence_data.mat_shot_probs;
      let opacity = delta_margin.map((x) => x);
      opacity[idx] = 1;
      return opacity;
    } else {
      const mat_shot_probs = DataLoader.influence_data.mat_shot_passive;
      let opacity = new Array(DataLoader.state.N).fill(0.1);
      mat_shot_probs.forEach((x, i) => (opacity[Model.ensemble.support_set_idxes[i]] = Math.sqrt(x)));
      return opacity;
    }
  };

  that.calculate_layout = function () {
    const tx = d3.event.pageX;
    const ty = d3.event.pageY;
    function layout_cost(x, y) {
      const margin = 5;
      x -= margin;
      y -= margin;
      function inrect(px, py) {
        return y < py && py < y + tooltip_height + 2 * margin && x < px && px < x + tooltip_width + 2 * margin;
      }
      if (y < 0 || x + tooltip_width > $(window).width()) return 99999999;
      if (inrect(tx, ty)) return 99999999;
      const cost1 =
        Math.max(Math.abs(ty - y), Math.abs(ty - y - tooltip_height)) +
        Math.max(Math.abs(tx - x), Math.abs(tx - x - tooltip_height));
      const cost2 = DataLoader.state.data
        .filter((d) => inrect(d.coord_x + 5 + that.div_rect.x, d.coord_y + 5 + that.div_rect.y))
        .map((d) => (d.selected ? 150 : 15))
        .sum();
      return cost1 + cost2 / 15;
    }
    let result = [0, 0, 99999999];
    for (let x = d3.event.pageX - 400; x <= d3.event.pageX + 200; x += 50) {
      for (let y = d3.event.pageY - 400; y <= d3.event.pageY + 200; y += 50) {
        cost = layout_cost(x, y);
        if (cost < result[2]) {
          result = [x, y, cost];
        }
      }
    }
    return [result[0], result[1]];
  };

  that.generate_labels = function() {
    const val = 1;
    let config = null;
    if (DataLoader.dataset == 'mnist') {
      config = {
        label: {
          range: 10,
          overlap_coef: .1,
          dist_coef: .1,
          purity_coef: 5,
        },
        label_img: {
          range: 5,
          overlap_coef: 1,
          dist_coef: 2,
          purity_coef: 25,
        },
        img: {
          range: 20,
          overlap_coef: 100,
          dist_coef: 0.2,
          purity_coef: 200,
        },
        purity: {
          margin: 2,
          lower_thres: 0.4,
        },
        misc: {
          font_size: 18,
          step: 4,
          thres: 80,
        }
      }
    } else if (DataLoader.dataset == 'cifar') {
      config = {
        label: {
          range: 10,
          overlap_coef: 2,
          dist_coef: 20,
          purity_coef: 100,
        },
        label_img: {
          range: 5,
          overlap_coef: 2,
          dist_coef: 2,
          purity_coef: 80,
        },
        img: {
          range: 5,
          overlap_coef: 8,
          dist_coef: 0.05,
          purity_coef: 100,
        },
        purity: {
          margin: 2,
          lower_thres: 0.0,
        },
        misc: {
          font_size: 16,
          step: 4,
          thres: 200,
        }
      }
    } 
    that._generate_labels(config);
    console.log(val, that.svg.selectAll(".additional-object").data().map(d => d.cost))
    that.svg.selectAll(".additional-object").filter(d => d.cost > config.misc.thres * val).remove()
    if (val < 0.2) that.svg.selectAll(".additional-object").filter(d => d.type !='label').remove()
  }
  that._generate_labels = function(config) {
    const font_size = config.misc.font_size;
    const step = config.misc.step;
    const max_cost = 99999999;
    const all_points = DataLoader.state.data;
    const svg = that.svg.select("#label-background");
    svg.selectAll(".additional-object").remove();
    that.additional_objects = [];
    if (!that.cost_matrix) {
      that.matrix_r = Math.ceil(that.height / step) + 2;
      that.matrix_c = Math.ceil(that.width / step) + 2;
      that.cost_matrix = Array(that.matrix_r).fill().map(()=>Array(that.matrix_c).fill(0));
      that.label_cost_matrix = Array(LabelCluster.N).fill().map(()=>Array(that.matrix_r).fill().map(()=>Array(that.matrix_c).fill(0)));
      that.total_count_matrix = Array(that.matrix_r).fill().map(()=>Array(that.matrix_c).fill(0));
      that.label_count_matrix = Array(LabelCluster.N).fill().map(()=>Array(that.matrix_r).fill().map(()=>Array(that.matrix_c).fill(0)));
      all_points.forEach(d => {
        const i = Math.floor(d.coord_y/step), j = Math.floor(d.coord_x/step);
        that.cost_matrix[i][j] += d.selected ? 10 : 5;
        that.label_cost_matrix[d.pred][i][j] += d.selected ? 10 : 5;
        if (d.margin > 0.1) {
          that.label_count_matrix[d.pred][i][j] += 1;
          that.total_count_matrix[i][j] += 1;
        }
      })
    }
    that.matrix_sum = ((matrix, i, j, h, w) => {
      const iL = Math.max(0, i), iU = Math.min(i+h, that.matrix_r);
      const jL = Math.max(0, j), jU = Math.min(j+w, that.matrix_c);
      let cost = 0;
      for (let i = iL; i < iU; ++i) for (let j = jL; j < jU; ++j)  cost += matrix[i][j];
      return cost;
    });
    that.overlap_cost = ((label, i, j, h, w, type) => {
      for (let obj of that.additional_objects) {
        const padding = (obj.type != 'label' && type != 'label') ? 2 : 1
        if (isRectOverlap(i, j, h, w, obj.i, obj.j, obj.h, obj.w, padding)) return max_cost;
      }
      return that.matrix_sum(that.cost_matrix, i, j, h, w) - 0.5 * that.matrix_sum(that.label_cost_matrix[label], i, j, h, w);
    })
    that.purity = ((label, i, j, h, w) => {
      i-=config.purity.margin; j-=config.purity.margin; w+=2*config.purity.margin; h+=2*config.purity.margin;
      const total = that.matrix_sum(that.total_count_matrix, i, j, h, w);
      if (total == 0) return 1;
      const cnt = that.matrix_sum(that.label_count_matrix[label], i, j, h, w);
      const cluster = LabelCluster.label_cluster[label];
      const other_labels = LabelCluster.get_all_label(cluster).filter(d => d !== label);
      const cluster_cnt = other_labels.map(l => that.matrix_sum(that.label_count_matrix[l], i, j, h, w)).sum();
      return  (cnt + cluster_cnt * 0.5) / total;
    })
    that.search_region = function(label, x, y, w, h, coef, type) {
      x = Math.floor(x / step);
      y = Math.floor(y / step);
      w = Math.floor(w / step);
      h = Math.floor(h / step);
      const jL = Math.max(0, x-coef.range), jU = Math.min(x+w+coef.range, that.matrix_c) - w;
      const iL = Math.max(0, y-coef.range), iU = Math.min(y+h+coef.range, that.matrix_r) - h;
      let best = [-1,-1,h,w,max_cost];
      for (let i = iL; i < iU; ++i) {
        for (let j = jL; j < jU; ++j) {
          const cost1 = that.overlap_cost(label, i, j, h, w, type) * Math.max(0.01, coef.overlap_coef);
          const cost2 = Math.sqrt((i - y) * (i - y) + (j - x) * (j - x)) * coef.dist_coef;
          const cost3 = (1-that.purity(label, i, j, h, w)) * coef.purity_coef;
          let cost = cost1 + cost2 + cost3;
          if (cost < best[4]) {
            best = [i, j, h, w, cost];
          }
        }
      }
      return best;
    }
    that.get_label_loc = ((label, x, y, w, h) => that.search_region(label, x, y, w, h, config.label, 'label'));
    that.get_label_img_loc = function(label, x, y, w, h, existing_rect=[])  {
      get_point_cost = (x,y,w,h) => DataLoader.state.data.filter(d => x<=d.coord_x && d.coord_x <= x+w && y <= d.coord_y && d.coord_y <= y+h).length
      get_boundary_cost = (x,y,w,h) => (x<plot_margin.left) || (x+w>plot_margin.left+that.width) || (y < plot_margin.top) || (y+h > plot_margin.top + that.height) ? 10000 : 0
      get_ambiguity_cost = function(x,y,w,h) {
        const p = 10
        let len1 = DataLoader.state.data.filter(d => d.selected && x-p<=d.coord_x && d.coord_x <= x+w+p && y-p <= d.coord_y && d.coord_y <= y+p).length;
        let len2 = DataLoader.state.data.filter(d => d.selected && x-p<=d.coord_x && d.coord_x <= x+w+p && y+h-p <= d.coord_y && d.coord_y <= y+h+p).length;
        let len3 = DataLoader.state.data.filter(d => d.selected && x-p<=d.coord_x && d.coord_x <= x+p && y-p <= d.coord_y && d.coord_y <= y+h+p).length;
        let len4 = DataLoader.state.data.filter(d => d.selected && x+w-p<=d.coord_x && d.coord_x <= x+w+p && y-p <= d.coord_y && d.coord_y <= y+h+p).length;
        if (len1 + len2 + len3 + len4 > 2) return 10000;
        return 0;
      }
      let similar_label_cnt = DataLoader.state.data.filter(d => d.pred == label && x+w/2-100<=d.coord_x && d.coord_x <= x+w/2+100&& y+h/2-100<=d.coord_y && d.coord_y <= y+h/2+100).length;
      const base_cost = (similar_label_cnt < 3) ? 10000 : 0;
      const p = 4;
      let candidates = [[x-w-p+.5,y-h-p+.5,w,h,1], [x-w-p,y+p,w,h,1], [x+p,y-h-p,w,h,1], [x+p,y+p,w,h,1],
          [x-w-p-1,y-h/2,w,h,0], [x+p+1,y-h/2,w,h,0], [x-w/2,y-h-p-2,w,h,0], [x-w/2,y+p+2,w,h,0]];
      for (let c of candidates) {
        c[4] += get_point_cost(c[0],c[1],c[2],c[3]);
        c[4] += get_boundary_cost(c[0],c[1],c[2],c[3]);
        c[4] += get_ambiguity_cost(c[0],c[1],c[2],c[3]);
        c[4] += base_cost;
        for (let r of existing_rect) {
          if (isRectOverlap(c[0],c[1],c[2],c[3], r.x,r.y,r.w,r.h, 6)) c[4] += 10000;
        }
      }
      candidates.sort((x,y) => x[4]-y[4]);
      return candidates;
    }
    that.get_img_loc = ((label, x, y, w, h) => that.search_region(label, x, y, w, h, config.img, 'img'));
    that.get_center = function(points_same_label, points_same_cluster) {
      let best = [null, 999999];
      for (let p of points_same_label) {
        const dist1 = points_same_label.map(d => Math.sqrt((d.coord_x - p.coord_x)*(d.coord_x - p.coord_x)+(d.coord_y - p.coord_y)*(d.coord_y - p.coord_y))).sum();
        const dist2 = points_same_cluster.map(d => Math.sqrt((d.coord_x - p.coord_x)*(d.coord_x - p.coord_x)+(d.coord_y - p.coord_y)*(d.coord_y - p.coord_y))).sum();
        const dist = dist1 + dist2 * (points_same_cluster.length < 30 ? 1 : 0);
        if (dist < best[1]) best = [p, dist];
      }
      return [[best[0].coord_x, best[0].coord_y]];
    }
    that.get_center_kmeans = function(points_same_label, points_same_cluster) {
      if (points_same_label.length < 2) return that.get_center(points_same_label, points_same_cluster);
      let vector = points_same_label.map(d=>[d.coord_x, d.coord_y]);
      let dist = (p1, p2) => Math.sqrt((p1[0]-p2[0])*(p1[0]-p2[0])+(p1[1]-p2[1])*(p1[1]-p2[1]));
      let measure_quality = (vector, centroids) => vector.map(point => Math.min(...centroids.map(c => dist(point, c)))).sum();
      let centroid1 = skmeans(vector, 1).centroids, centroid2 = skmeans(vector, 2).centroids
      let cost1 = measure_quality(vector, centroid1), cost2 = measure_quality(vector, centroid2);
      if (cost2 < cost1 / 2) return centroid2;
      else return that.get_center(points_same_label, points_same_cluster);
    }
    const n_fill = DataLoader.dataset == 'mnist' ? 3 : 2;
    let used_labels = Array(LabelCluster.N).fill(n_fill);
    let used_idxes = [];
    that.additional_shot_images = []
    for (let k = 0; k < 5; ++k) {
      for (let label = 0; label < LabelCluster.N; ++label) {
          const name = LabelCluster.label2name[label];
            if (used_labels[label] <= 0) continue;
            const points = all_points.filter(d => d.pred == label && d.selected)
            .map(d => ({
                x: d.coord_x, y:d.coord_y,
                idx: d.idx,
            }))
            const point = points[k];
            if (!point) continue;
            const w = 32, h = 32;
            const result = that.get_label_img_loc(label, point.x, point.y, w, h, that.additional_shot_images);
            console.log(result)
            if (result[0][4] < 50) {
              that.additional_shot_images.push({x:result[0][0],y:result[0][1],w:result[0][2],h:result[0][3], href: DataLoader.get_image_base64(point.idx), neighbor: that._get_neighbors(result[0][0], result[0][1]), label:label, i: point.idx});
            }
      }
    }
    let enter = svg.selectAll(".additional-object").data(that.additional_objects).enter()
    enter.filter(d => d.name).append("rect").classed("additional-object", true).attr("x", d => d.x).attr("y", d => d.y).classed("additional-object", true)
    .attr("width", d => d.w * step).attr("height", d => font_size).attr("fill", d => "white").attr("fill-opacity", 0.66)
    enter.filter(d => d.name).append("text").classed("additional-object", true).attr("x", d => d.x).attr("y", d => d.y + font_size).text(d => d.name).classed("additional-object", true)
    .attr("font-size", font_size).attr("fill", d => LabelCluster.cluster2colors[LabelCluster.origin_label_cluster[d.label]][3])
    enter.filter(d => !d.name).append("image")
    .classed("additional-object", true)
    .attr("xlink:href", d => d.href)
    .attr("x", d => d.x).attr("y", d => d.y)
    .attr("width", d => d.w * step).attr("height", d => d.h * step)
    enter.filter(d => !d.name).append("rect")
    .classed("additional-object", true)
    .attr("x", d => d.x).attr("y", d => d.y)
    .attr("width", d => d.w * step).attr("height", d => d.h * step)
    .attr("stroke-width", 1).attr("stroke", "#72758d").attr("fill", "none")

    let img_enter = svg.selectAll(".additional-object").data(that.additional_shot_images).enter()
    img_enter.append("image")
    .classed("additional-object", true)
    .attr("xlink:href", d => d.href)
    .attr("x", d => d.x).attr("y", d => d.y)
    .attr("width", d => d.w ).attr("height", d => d.h )
    img_enter.append("rect")
    .classed("additional-object", true)
    .attr("x", d => d.x).attr("y", d => d.y)
    .attr("width", d => d.w).attr("height", d => d.h)
    .attr("stroke-width", 1).attr("stroke", "#72758d").attr("fill", "none")
  }

  that._get_neighbors = function(x, y, w=80, h=80) {
    const xL = x - w / 2, xU = x + w / 2, yL = y - h / 2, yU = y + h / 2;
    return DataLoader.state.data.filter(d => xL <= d.coord_x && d.coord_x <= xU && yL <= d.coord_y && d.coord_y <= yU);
  }
  


  that.sample_on_mouseover = function (d) {
    if (!that.hover_activate) return;
    if (d.display_opacity < 0.1) return;
    that.mouseover_state = d.idx;
    const [x, y] = that.calculate_layout();
    tooltip.style("opacity", 1).style("left", `${x}px`).style("top", `${y}px`)
    tooltip.html(`<img style="border:1.5px solid black" src="${DataLoader.get_image_base64(d.idx)}" height=${tooltip_height}px width=${tooltip_height}px>`);
    d3.select(this).attr("d", d => d.selected ? STAR_6 : CIRCLE_6).raise();
    DataLoader.get_influence(d.idx, (data) => {
      if (that.mouseover_state !== d.idx) return;
      that.mouseover_state = -2 - d.idx;
      DataLoader.influence_data = data;
      DataLoader.save_info();
      console.log("influence", data);
      const opacity = that.calculate_opacity_based_on_influence(d.idx);
      Matrix.highlight([d.idx]);
      DataLoader.set_data_attr("display_opacity", opacity);
      DataLoader.state.data[d.idx].mouseover = true;
      that._refresh_color();
    });
  };

  that.sample_on_mouseout = function (d) {
    if (that.mouseover_state === -1) return;
    if (d.display_opacity < 0.1) return;
    tooltip.style("opacity", 0)
    if (that.mouseover_state < -1) {
      DataLoader.load_info();
      Matrix.highlight(Highlight.idx);
      that.refresh_color();
    }
    that.mouseover_state = -1;
    DataLoader.state.data[d.idx].mouseover = false;
    d3.select(this).attr("d", d => d.selected ? STAR_4 : CIRCLE_4);
  };

  that.sample_on_click = function (d, value) {
    value = value || false
    d.selected = value ? value : !d.selected;
    that._refresh_color();
  };

  that.refresh_color = function () {
    if (!that.initialized) return;
    that.change_filter();
    that._set_color_label();
    that._set_color_opacity();
    that._refresh_color();
  };

  that._update_opacity = function() {
    
    let highlight_cnt = DataLoader.state.data
      .filter(d => d.display_opacity > 0.2)
      .length
    let highlight_a_few =
      highlight_cnt < DataLoader.state.data.length * 0.2 &&
      DataLoader.state.data[0].margin_diff == null

    let scatters = that.svg
      .selectAll(".scatter")
      .data(DataLoader.state.data, (d) => d.id)
    
    scatters
      .style("stroke-opacity", (d) => d.display_opacity)
      .style("fill-opacity", (d) => d.display_opacity)
    scatters
      .filter(d => d.selected)
      .raise()

    scatters
      .filter(d => d.display_opacity > 0.2)
      .raise()

    scatters
      .filter(d => d.selected && d.display_opacity > 0.2)
      .raise()
  }

  that._refresh_color = function () {

    let highlight_cnt = DataLoader.state.data
      .filter(d => d.display_opacity > 0.2)
      .length
    let highlight_a_few =
      highlight_cnt < DataLoader.state.data.length * 0.2 &&
      DataLoader.state.data[0].margin_diff == null

    let scatters = that.svg.selectAll(".scatter")
    
    scatters
      .style("stroke", (d) => d.stroke_color)
      .style("stroke-width", (d) => .5)
      .style("stroke-dasharray", (d) => (d.recommended ? 1 : 0))
      .style("stroke-opacity", (d) => d.display_opacity)
      .attr("d", d => d.selected ? STAR_4 : CIRCLE_4)
      .style("fill", (d) => d.selected ? ColorChangeLight(d.display_color, 0.45): d.display_color)
      .style("fill-opacity", (d) => d.display_opacity);
    scatters
      .filter(d => d.selected)
      .raise()

    scatters
      .filter(d => d.display_opacity > 0.2)
      .raise()

    scatters
      .filter(d => d.selected && d.display_opacity > 0.2)
      .raise()

    let additional = that.svg.selectAll(".additional-object");

    let labels_of_interested = Highlight.idx ? new Set(Highlight.idx.map(i => DataLoader.state.data[i].pred)): new Set(FE(LabelCluster.N));

    additional.style("opacity", d => d.neighbor.map(d => d.display_opacity).average() > 0.25 && labels_of_interested.has(d.label) ||
     (Highlight.idx && Highlight.idx.includes(d.i)) || (DataLoader.state.data[d.i].display_opacity > 0.9) ? 1 : 0.1)

    that.generate_arrow_glyph();
  };

  that._set_color_label = function () {
    if (that.color_mode === 6) {
      const attr = that.show_uncertain ? "uncertain_pred" : "pred";
      DataLoader.state.data.forEach((d) => (d.display = d.selected ? d.label : d[attr]));
    } else if (that.color_mode === 2) {
      DataLoader.state.data.forEach((d) => (d.display = d.gt_label));
    }
    DataLoader.state.data.forEach((d) => (d.display_color = LabelCluster.dark_color[d.display]));
    DataLoader.state.data.forEach((d) => (d.stroke_color = LabelCluster.full_color[d.display]));
  };

  that.linear_transform = function (lower, higher) {
    return function (x) {
      if (x < lower) return 0;
      if (x > higher) return 1;
      return (x - lower) / (higher - lower);
    };
  };

  that.influence2opacity = that.linear_transform(0, 0.2);
  that.coverage2opacity = that.linear_transform(0.2, 0.8);

  that.margin2opacity = function (d) {
    return d.filter_keep ? that._margin2opacity(d.margin) * keep_opacity_coef + keep_opacity_min : discard_opacity;
  };

  that._set_color_opacity = function () {
    if (Highlight.idx !== null) {
      DataLoader.state.data.forEach((d) => (d.display_opacity = d.filter_keep ? 1 : discard_opacity));
      return;
    }

    if (DataLoader.state.data[0].margin_diff !== null) {
      DataLoader.state.data.forEach(
        (d) => (d.display_opacity = Math.abs(d.margin_diff) < 0.1 ? discard_opacity : Math.abs(d.margin_diff) * 4)
      );
      return;
    }
    that._margin2opacity = that.linear_transform(0, 0.8);
    DataLoader.state.data.forEach((d) => (d.display_opacity = that.margin2opacity(d)));
  };
  that.important = function (d) {
    if (Math.abs(d.margin_diff) > 0.25) return true;
    return false;
  };
  that.generate_arrow_glyph = function () {
    that.svg.selectAll(".arrow-glyph").remove();
    that.svg.selectAll(".gray-density").remove();
    if (DataLoader.state.data[0].margin_diff === null) {
      return;
    }

    let glyph_size = 7.5
    that.svg
      .select("#plot-scatter")
      .selectAll(".arrow-glyph")
      .data(DataLoader.state.data.filter(d => that.important(d)), (d) => d.id)
      .enter()
      .append("path")
      .classed("arrow-glyph", true)
      .attr("transform", 
        d =>
        d.margin_diff < 0 ?
        `translate(${d.coord_x + glyph_size * 0.5},${d.coord_y - glyph_size}) scale(${glyph_size / 512 * 0.7}, ${glyph_size / 512})` :
        `translate(${d.coord_x + glyph_size},${d.coord_y}) scale(${glyph_size / 512 * 0.7}, ${glyph_size / 512}) rotate(180)`)
      .attr("d", "M479.046,283.925c-1.664-3.989-5.547-6.592-9.856-6.592H352.305V10.667C352.305,4.779,347.526,0,341.638,0H170.971c-5.888,0-10.667,4.779-10.667,10.667v266.667H42.971c-4.309,0-8.192,2.603-9.856,6.571c-1.643,3.989-0.747,8.576,2.304,11.627l212.8,213.504c2.005,2.005,4.715,3.136,7.552,3.136s5.547-1.131,7.552-3.115l213.419-213.504C479.793,292.501,480.71,287.915,479.046,283.925z")
      .attr("stroke", "none")
      .attr("fill", (d) => (d.margin_diff > 0 ? "#888888" : "#888888"))
      .style("fill-opacity", (d) => d.display_opacity)
    
    let margin_thres = 0.16;
    let up_points = DataLoader.state.data.filter(d => d.margin_diff > margin_thres)
    let down_points = DataLoader.state.data.filter(d => d.margin_diff < -margin_thres)
    let thres = 0.104
    let point_thres = DataLoader.state.data.length * 0.1;

    let get_density = (data, color, stroke, current_thres) => {
      const density = d3
        .contourDensity()
        .x((d) => d.coord_x)
        .y((d) => d.coord_y)
        .size([that.width, that.height])
        .thresholds([current_thres])
        .bandwidth(19.99)(data)

      for (let i = 0; i < density.length; ++i) {
        density[i].color = color
        density[i].stroke = stroke
        density[i].opacity = 1
        density[i].is_first = 1
      }
      let ret = density[0]
      ret.coordinates = ret.coordinates.filter(d => d[0].length > 20)
      if (Math.abs(current_thres - thres) < 1e-3 && ret.coordinates.length > 2) {
        let ret2 = get_density(data, color, stroke, current_thres * 0.75)
        for (let i = 0; i < ret.coordinates.length; ++i) {
          let c = d3.polygonCentroid(ret.coordinates[i][0])
          for (let j = 0; j < ret2.coordinates.length; ++j) {
            if (d3.polygonContains(ret2.coordinates[j][0], c)) {
              ret.coordinates[i][0] = ret2.coordinates[j][0]
            }
          }
        }
      }
      return ret
    }

    that.gray_densities = [
      get_density(up_points, 'rgb(233,233,240)', 'rgb(158,158,180)', thres),
      get_density(down_points, 'rgb(233,233,240)', 'rgb(158,158,180)', thres)
    ]

    let svg = that.svg.select("#plot-background");
    let slc = svg.selectAll(".gray-density").data(that.gray_densities)

    let slcEnter = slc
      .enter()
      .append("path")
      .classed("gray-density", true)
      .style("pointer-events", "none");

    slcEnter = slcEnter
      .style("opacity", 0)
      .attr("fill-opacity", (d) => d.opacity)
      .attr("fill", (d) => d.color)
      .attr("stroke", (d) => d.stroke)
      .attr("stroke-width", '1px')
      .attr("d", (d) => d3.geoPath()(d))
      .transition()
      .duration(200)
      .style("opacity", 1)
  };

  that.set_color_mode = function (mode) {
    if (mode === 0) that.color_mode = ColorMode.coverage;
    if (mode === 1) that.color_mode = ColorMode.margin;
    if (mode === 2) that.color_mode = ColorMode.label;
    if (mode === 3) that.color_mode = ColorMode.pred;
    if (mode === 4) that.color_mode = ColorMode.diff;
    if (mode === 5) that.color_mode = ColorMode.coverage_uncertain;
    if (mode === 6) that.color_mode = ColorMode.margin_uncertain;
    if (mode === 7) that.color_mode = ColorMode.pred_diff;
    that.refresh_color();
  };

  that.change_filter = function () {

    [margin_lower, margin_upper] = that.margin_filter.noUiSlider.get();
    [learner_lower, learner_upper] = that.learner_filter.noUiSlider.get();
    if (Highlight.idx) {
      DataLoader.state.data.forEach((d) => (d.filter_keep = false));
      Highlight.idx.forEach((i) => (DataLoader.state.data[i].filter_keep = true));
    } else {
      DataLoader.state.data.forEach((d) => (d.filter_keep = true));
    }
    DataLoader.state.data.forEach(
      (d) =>
        (d.filter_keep =
          d.filter_keep &&
          margin_lower <= d.margin &&
          d.margin <= margin_upper &&
          learner_lower <= d.confidence_cnt &&
          d.confidence_cnt <= learner_upper)
    );

    if (Highlight.idx && Highlight.type !== "temp") {
      const idx = DataLoader.state.data.filter((d) => d.filter_keep).map((d) => d.idx);
      Model.update_table(idx);
      Matrix.highlight(idx);
    }
  };

  that.refresh_arrow = function(idx) {
    Matrix.highlight(idx);
    if (!idx) {
      Matrix.rows.forEach(d => {
        d.info.avg_selected_margin =
          d.info.margin.reduce((a, b) => a + b, 0) / DataLoader.state.data.length
      })
    } else {
      let selected_idx_set = new Set(idx)
      Matrix.rows.forEach(d => {
        d.info.avg_selected_margin =
          d.info.margin.filter((_, index) =>
            selected_idx_set.has(index)
          ).reduce((a, b) => a + b, 0) / idx.length
      })
    }
  }

  that.init_lasso = function () {
    that.scatter_brush = d3
      .lasso()
      .closePathSelect(true)
      .closePathDistance(200)
      .items(that.svg.selectAll(".scatter.show"))
      .targetArea(that.svg)
      .on("start", function () {
        that.hover_activate = false;
        //that.scatter_brush
        //  .items()
        //  .data()
        //  .forEach((d) => (d.display_opacity = 0.1));
        that._update_opacity();
      })
      .on("draw", function () {
        if (Highlight.idx) {
          that.scatter_brush
            .possibleItems()
            .data()
            .forEach((d) => (d.display_opacity = d.filter_keep ? 1 : discard_opacity));
          that.scatter_brush
            .notPossibleItems()
            .data()
            .forEach((d) => (d.display_opacity = d.filter_keep ? 0.5 : discard_opacity));
        } else {
          that.scatter_brush
            .possibleItems()
            .data()
            .forEach((d) => (d.display_opacity = 1));
          that.scatter_brush
            .notPossibleItems()
            .data()
            .forEach((d) => (d.display_opacity = 0.1));
        }
        that._update_opacity();
      })
      .on("end", function () {
        that.hover_activate = true;
        const selected_idx = that.scatter_brush
          .selectedItems()
          .data()
          .map((x) => x.idx);
        if (selected_idx.length > 0) {
          DataLoader.select(selected_idx, "lasso");
          that.refresh_arrow(selected_idx)
        } else {
          DataLoader.unselect("lasso")
          that.refresh_arrow()
        }
      });
    that.svg.call(that.scatter_brush);
  };
  that.toggle_cluster = function(cluster, show) {
    const points = d3.selectAll(".scatter").filter(d => LabelCluster.label_cluster[d.ensemble_pred] === cluster);
    points.classed("show", show);
    points.classed("hide", !show);
    const additional = d3.selectAll(".additional-object").filter(d => LabelCluster.label_cluster[d.label] === cluster);
    additional.classed("show", show);
    additional.classed("hide", !show);
    const densities = d3.selectAll(".density").filter(d => d.renderData.cluster == cluster);
    densities.classed("show", show);
    densities.classed("hide", !show);
  }


  that.zoom_in = function() {
    that.zoomed = true;
    if (!Highlight.idx) return;
    const current_x = Highlight.idx.map(i => DataLoader.state.data[i].x);
    const current_y = Highlight.idx.map(i => DataLoader.state.data[i].y);
    const xmin = Math.floor(Math.min(...current_x));
    const xmax = Math.ceil(Math.max(...current_x));
    const ymin = Math.floor(Math.min(...current_y));
    const ymax = Math.ceil(Math.max(...current_y));
    const new_data = DataLoader.state.all_data.filter(d => xmin < d.x && d.x < xmax && ymin < d.y && d.y < ymax)
    
    $("#loading")[0].style.display = "block";
    const node = new request_node(
      that.zoom_in_url,
      (data) => {
        $("#loading")[0].style.display = "none";
        DataLoader.state.N = new_data.length;
        DataLoader.state.data = new_data;
        DataLoader.state.data.forEach((d,idx) => {
          d.idx = idx;
          d.image = data.images[idx];
          d.margin_diff=null;
          d.selected=false;
          d.recommended=false;
          d.highlighted=false;
          d.mouseover=false;
          d.influence=1;
          d.filter_keep=true;
        });
        const ensemble_info = data.ensemble_info;
        DataLoader.set_data_attr("pred", ensemble_info.pred);
        DataLoader.set_data_attr("uncertain_pred", ensemble_info.uncertain_pred);
        DataLoader.set_data_attr("ensemble_pred", ensemble_info.pred);
        DataLoader.set_data_attr("ensemble_uncertain_pred", ensemble_info.uncertain_pred);
        DataLoader.set_data_attr("margin", ensemble_info.margin);
        DataLoader.set_data_attr("probs", ensemble_info.probs);
        DataLoader.state.data.forEach(
          (d) =>
            (d.confidence_cnt = ensemble_info.learner_margin.map((model) => model[d.idx]).filter((x) => x > 0.5).length)
        );
        Highlight.clear();
        Scatterplot.generate_scatterplot();
      },
      "json",
      "POST"
    );
    node.set_header({
      "Content-Type": "application/json;charset=UTF-8",
    });
    node.set_data({
      ids: new_data.map(d => d.id),
    });
    node.notify();
  }

  that.zoom_back = function() {
    that.zoomed = false;
    DataLoader.state.data = DataLoader.state.first_layer_data;
    that.generate_scatterplot();
  }
};
