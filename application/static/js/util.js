Array.prototype.union =
  Array.prototype.union ||
  function (i) {
    if (!this.includes(i)) this.push(i);
  };
Array.prototype.remove =
  Array.prototype.remove ||
  function (i) {
    if (this.includes(i)) this.splice(this.indexOf(i), 1);
  };
Array.prototype.sum =
  Array.prototype.sum ||
  function () {
    return this.reduce(function (sum, a) {
      return sum + Number(a);
    }, 0);
  };

Array.prototype.average =
  Array.prototype.average ||
  function () {
    return this.sum() / (this.length || 1);
  };

  Array.prototype.max =
  Array.prototype.max ||
  function () {
    return Math.max(...this)
  };

const FE = (n) => Array.from(Array(n).keys());
const my_round2 = (x) => Math.round((x + Number.EPSILON) * 10) / 10;
const my_round3 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const my_round4 = (x) => Math.round((x + Number.EPSILON) * 1000) / 1000;
const my_round5 = (x) => Math.round((x + Number.EPSILON) * 10000) / 10000;
const to_percnet = (x) => Math.round(x * 100).toString() + "%";

const trunc_val = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
function weighted_sum(values, weights) {
  let n = values[0].length;
  let n_dim = weights.length;
  let ret = new Array(n).fill(0);
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < n_dim; ++j) {
      ret[i] += values[j][i] * weights[j];
    }
  }
  return ret;
}
function hsl2rgb(h, s, l) {
  let r;
  let g;
  let b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgb2hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function adjustColorOpacity(rgb, a) {
  let [r,g,b] = hex2rgb(rgb);
  r = Math.floor(r * a + 255 * (1 - a));
  g = Math.floor(g * a + 255 * (1 - a));
  b = Math.floor(b * a + 255 * (1 - a));
  return hex2color(r,g,b);
}

function hex2rgb(col) {
  col = col.slice(1);
  const num = parseInt(col, 16);
  const r = num >> 16;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return [r, g, b];
}
const hex = d => Number(d).toString(16).padStart(2, '0')
function hex2color(r, g, b) {
  return "#" + hex(r)+hex(g)+hex(b);
}

function adjustColorL(col) {
  const rgb = hex2rgb(col);
  const hsl = rgb2hsl(rgb[0], rgb[1], rgb[2]);
  const new_rgb = hsl2rgb(hsl[0], hsl[1], 1);
  return new_rgb;
}

function LightenDarkenColor(col) {
  const rgb = hex2rgb(col);
  const hsl = rgb2hsl(rgb[0], rgb[1], rgb[2]);
  const rgb1 = hsl2rgb(hsl[0], hsl[1], 0.55);
  const rgb2 = hsl2rgb(hsl[0], hsl[1], 0.75);
  return [hex2color(rgb1[0], rgb1[1], rgb1[2]), hex2color(rgb2[0], rgb2[1], rgb2[2])];
}
function ColorChangeLight(col, l) {
  const rgb = hex2rgb(col);
  const hsl = rgb2hsl(rgb[0], rgb[1], rgb[2]);
  const new_rgb = hsl2rgb(hsl[0], hsl[1], l);
  return hex2color(new_rgb[0], new_rgb[1], new_rgb[2])
}

function getRandomSubarray(arr, size) {
  var shuffled = arr.slice(0),
    i = arr.length,
    min = i - size,
    temp,
    index;
  while (i-- > min) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled.slice(min);
}

function deepCopy(obj) {
  x = JSON.parse(JSON.stringify(obj));
  x.id = x.id + 1;
  return x;
}

function draw_indicate_line_coord(g, x1, x2, y1, y2, type = 0, config = null) {
  /*
                  x1,y1       x2,y1
      type: 0       |-----------|
                  x1,y2       x2,y2

                  x1,y1-------x2,y1
      type: 1             |  
                  x1,y2-------x2,y2
  */
  if (type === 0) {
    const p1 = { x: x1, y: y1 };
    const p2 = { x: x1, y: y2 };
    const p3 = { x: x2, y: y1 };
    const p4 = { x: x2, y: y2 };
    draw_indicate_line_point(g, p1, p2, p3, p4, config);
  } else {
    const p1 = { x: x1, y: y1 };
    const p2 = { x: x2, y: y1 };
    const p3 = { x: x1, y: y2 };
    const p4 = { x: x2, y: y2 };
    draw_indicate_line_point(g, p1, p2, p3, p4, config);
  }
}
function draw_indicate_line_point(g, p1, p2, p3, p4, config = null) {
  /*
       p1          p3
        |----------|
       p2          p4
  */
  if (config === null) config = {};
  if (!config.stroke_color) config.stroke_color = "#000000";
  if (!config.stroke_width) config.stroke_width = 1;
  g.append("line")
    .attr("x1", p1.x)
    .attr("y1", p1.y)
    .attr("x2", p2.x)
    .attr("y2", p2.y)
    .attr("stroke", config.stroke_color)
    .attr("stroke-width", config.stroke_width);
  g.append("line")
    .attr("x1", p3.x)
    .attr("y1", p3.y)
    .attr("x2", p4.x)
    .attr("y2", p4.y)
    .attr("stroke", config.stroke_color)
    .attr("stroke-width", config.stroke_width);
  g.append("line")
    .attr("x1", (p1.x + p2.x) / 2)
    .attr("y1", (p1.y + p2.y) / 2)
    .attr("x2", (p3.x + p4.x) / 2)
    .attr("y2", (p3.y + p4.y) / 2)
    .attr("stroke", config.stroke_color)
    .attr("stroke-width", config.stroke_width);
}

function draw_text(g, content, x, y, font_size, config = null) {
  if (config === null) config = {};
  if (!config.fill) config.fill = "black"
  if (!config.h_anchor) config.h_anchor = "middle"; // "start end middle"
  if (!config.v_anchor) config.v_anchor = "middle"; // "above middle below"
  if (!config.bold) config.bold = "normal";
  const v_anchor_map = { above: "0em", middle: "0.4em", below: "1em" };
  const dy = v_anchor_map[config.v_anchor];
  return g
    .append("text")
    .text(content)
    .attr("font-size", font_size)
    .attr("text-anchor", config.h_anchor)
    .attr("x", x)
    .attr("y", y)
    .attr("dy", dy)
    .attr("font-weight", config.bold)
    .attr("fill", config.fill);
}

function convertRemToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}


function adjust_y(acc_Y, learner_cluster) {
  const N = acc_Y.length - 1
  let clusters = []
  for(let i = 0; i < N; ++i) {
    clusters.push(learner_cluster[i]);
  }
  clusters.sort((a,b)=>a-b);
  for (let i = 0; i < N; ++i) {
    acc_Y[i] += 40 * clusters[i];
  }
  acc_Y[N] += 40 * clusters[N-1];
}

function inverse(arr) {
  let ret = []
  for (let i = 0; i < arr.length; ++i) ret[arr[i]] = i;
  return ret;
}

function generate_linear_gradient(color1, color2) {
  this.stores = {};
  const def = d3.select("svg#defsvg defs");
  let key = `linear-${color1.substr(1)}-${color2.substr(1)}`;
  if (this.stores[key]) return this.stores[key];
  let grad = def.append('linearGradient').attr("id", key);
  grad.append("stop").attr("offset", "0%").attr("stop-color", color1);
  grad.append("stop").attr("offset", "100%").attr("stop-color", color2);
  this.stores[key] = `url(#${key})`
  return this.stores[key];
}

function draw_text_multiline(text, content, font_size, width, height=-1, autosplit=true) {
  let tmp = [];
  if (autosplit) {
    const max_len = 3;
    let lines = content.split('\n');
    let short = lines.filter(d => getTextWidth(d, font_size) <= width*.95);
    let long = lines.filter(d => getTextWidth(d, font_size) > width*.95);
    let selected_cnt = 0;
    for (let word of short) { if (tmp.length < max_len) tmp.push(word); selected_cnt += 1;}
    for (let word of long) {
      let splits = WORD_SPLIT[word];
      if (splits && splits.length <= max_len - tmp.length) {
        selected_cnt += 1;
        for (let t of splits) tmp.push(t);
      } else {
        if (getTextWidth(word, font_size) < width * 1.25) tmp.push(word)
      }
    }
  } else {
    tmp = content.split('\n');
  }

  //if (lines.length > 3) {lines = [lines[0], lines[1], lines[2] + `(+${lines.length-3})`]}
  if (height === -1) height = tmp.length * font_size;
  let offset = (height - (tmp.length + 1) * font_size) / 2;
  text.html(null);
  text.attr("font-size", font_size).attr("text-anchor", "middle");
  text.selectAll("tspan").data(tmp).enter().append("tspan")
    .text(d => d)
    .attr("x", 0)
    .attr("y", (d,i) => offset + i * font_size)
}

function array_eq(arr1, arr2) {
  if (arr1.length !== arr2.length)return false;
  for (let i = 0; i < arr1.length; ++i) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}
function set_eq(arr1, arr2) {
  let tmp1 = arr1.slice().sort((x,y) => x-y);
  let tmp2 = arr2.slice().sort((x,y) => x-y);
  return array_eq(tmp1, tmp2);
}

function sim_measure_arr(arr1, arr2) {
  let intersection = arr1.filter(x => arr2.includes(x));
  return intersection.length / arr1.length;
}

function filter_idx(arr, pred) {
  return arr.map((d,i) => ({d:d, i:i})).filter(pair => pred(pair.d)).map(d => d.i);
}

function getTextWidth(text, font) {
  let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  let context = getTextWidth.context || (getTextWidth.context = canvas.getContext("2d"));
  context.font = font;
  return context.measureText(text).width;
}

function isRectOverlap(x1,y1,w1,h1, x2,y2,w2,h2, padding) {
    return !( (x1+w1+padding <= x2) || (y1+h1+padding <= y2) || 
              (x2+w2+padding <= x1) || (y2+h2+padding <= y1))
}

function adjust_cluster(label_cluster) {
  let tmp = -1;
  for (let i = 0; i < label_cluster.length; ++i) {
    const c = label_cluster[i];
    if (c >= 0) {
      for (let j = 0; j < label_cluster.length; ++j) {
        if (label_cluster[j] == c) label_cluster[j] = tmp;
      }
      tmp -= 1;
    }
  }
  return label_cluster.map(d => -d-1);
}

function adjust_cluster_ordered(label_cluster, selected_idx) {
  let keys = Array.from(new Set(label_cluster))
  let d = keys.map(key => ({key: key, arr: [], good:[]}));
  for (let i = 0; i < label_cluster.length; ++i) {
    const key = label_cluster[i];
    const elem = d.find(d => d.key == key);
    elem.arr.push(i);
    if (selected_idx.includes(i)) elem.good.push(i);
    else if (i == 20) elem.good.push(i)
  }
  const order = d.sort((x,y) => (x.good.length != y.good.length) ? y.good.length - x.good.length : y.arr.length - x.arr.length).map(d => d.key);
  let new_label_cluster = Array(label_cluster.length).fill(-1);
  for (let i = 0; i < label_cluster.length; ++i) {
    new_label_cluster[i] = order.findIndex(d => d == label_cluster[i])
  }

  return new_label_cluster;
}
