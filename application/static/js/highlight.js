Highlight = function () {
  const that = this;
  that.idx = null;
  that.type = null;
  that.record_highlight_idx = [];
  that.record_source = [];

  that.update = function (new_idx = null) {
    console.log("Highlight update");
    if (new_idx) {
      if (that.idx === null) {
        that.idx = new_idx.map((d) => d);
      } else {
        that.idx = that.idx.filter((x) => new_idx.includes(x));
      }
    } else {
      if (that.record_highlight_idx.length === 0) {
        that.idx = null;
      } else {
        that.idx = that.record_highlight_idx[0];
        for (let _idx of that.record_highlight_idx)
          that.idx = that.idx.filter((x) => _idx.includes(x));
      }
    }
  };
  that.add_highlight = function (highlight_idx, source) {
    console.log("add highlight", highlight_idx, source);
    let i = that.record_source.indexOf(source);
    if (i === -1) {
      that.record_highlight_idx.push(highlight_idx);
      that.record_source.push(source);
      that.update(highlight_idx);
      that.type = source;
    } else {
      that.record_highlight_idx[i] = highlight_idx;
      that.update();
      that.type = source;
    }
  };
  that.rm_highlight = function (source) {
    console.log("rn highlight", source);
    let i = that.record_source.length - 1;
    while (i >= 0) {
      if (that.record_source[i] !== source) --i;
      else break;
    }
    if (i >= 0) {
      that.record_highlight_idx.splice(i, 1);
      that.record_source.splice(i, 1);
      that.update();
    }
    if (that.record_source.length === 0) {
      that.type = null;
    } else {
      that.type = that.record_source[that.record_source.length - 1];
    }
  };
  that.clear = function() {
    that.idx = null;
    that.type = null;
    that.record_highlight_idx = [];
    that.record_source = [];
  }
};
