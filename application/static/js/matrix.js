Matrix = function () {
  const first_col_offset = -2;
  const min_width = 10;
  const min_height = 5;
  const light_blue_gray = "#98a6b3";

  const left_opacity = 0.4;
  const right_opacity = 0.65;

  const legend_font_size = convertRemToPixels(0.9);
  const font_size = convertRemToPixels(1.0);
  const label_font_size = convertRemToPixels(0.7);
  const actual_label_font_size = DataLoader.dataset == 'mnist'? convertRemToPixels(0.9): convertRemToPixels(0.7);
  const small_num_font_size = convertRemToPixels(0.8);

  const row_width = 0;
  const cbox_xoffset = 18;
  const row_name_width = 140;

  const col_top = 40;
  const col_height = 40;
  const col_id_offset = 38;
  const col_val_offset = 10;

  const margin = 0.08;
  //const row_margin = 0.2;
  const row_margin = 0.2;
  const col_margin = 0.08;
  const gray_scale_linear_base = d3.scaleLinear().domain([0.15, 0.6]).range(["#ffffff", "#4f5370"]);
  const gray_scale_linear_1 = d3.scaleLinear().domain([0.15, 0.25]).range(["#ffffff", gray_scale_linear_base(0.35)]);
  const gray_scale_linear_2 = d3.scaleLinear().domain([0.25, 0.55]).range([gray_scale_linear_base(0.35), gray_scale_linear_base(0.45)]);
  const gray_scale_linear_3 = d3.scaleLinear().domain([0.55, 0.6]).range([gray_scale_linear_base(0.45), "#4f5370"]);
  const gray_scale_linear = d => (d < 0.25) ? gray_scale_linear_1(d) : (d < 0.55) ? gray_scale_linear_2(d) : gray_scale_linear_3(d);
  const gray_scale = gray_scale_linear;
  const that = this;
  that.confirm_idxes = [];
  that.all_sliders = [];

  const div_margin = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
  const plot_margin = {
    left: row_width + row_name_width + 10,
    right: 0,
    top: col_height + col_id_offset + col_top + 10,
    bottom_ratio: 0.19,
  };

  const tooltip = d3
    .select("#matrix")
    .append("div")
    .attr("class", "tooltip")
    .attr("id", "tooltip1")
    .style("opacity", 0);

  let Animation = {
    enter: 300,
    update: 1000,
    exit: 100,
    gap: 10,
  };
  Animation.updateDelay = Animation.exit + Animation.gap;
  Animation.enterDelay =  Animation.update + Animation.gap;

  const div = d3.select("#matrix");
  const svg = div.select("svg");

  that.row_mode = 'compact';
  that.current_select_box = null;
  that.current_barchart = null;

  that.rows = [];
  that.cols = [];
  that.cells = [];
  that.focus_cells = [];
  that.N = 0;

  that.animation_flag = false;
  that.animation_func_id = -1;

  that.row_mouseover_state = -1;

  that.layout = {};

  that.current_highlight_row = [];

  that.reset = function() {
    svg.html(null);
    that.rows = that.cols = that.cells_overall = that.cells = null;
  }

  that.generate_matrix = function () {
    svg.html(null);
    svg.append("g").attr("id", "rows").append("g").attr("class", "highlight");
    svg.append("g").attr("id", "cols").append("g").attr("class", "highlight");
    svg.append("g").attr("id", "legend");
    svg.append("g").attr("id", "matrix");
    that.first_time = true;
    that.generate_render_data();
    that.calculate_layout(true);
    that.draw_legend();
    that.render_row_column(true);
    that.render_background();
    that.generate_detail();
    that.render_row_column(false); // only for fix drag bug
    that.first_time = false;
    const tmp = [].concat(that.rows).concat(that.cells_overall).concat(that.cells)
    tmp.forEach(d => d.old_y = d.y);
    tmp.forEach(d => d.xoffset = 0);
  };

  that.full_update = function() {
    that.generate_render_data();
    that.calculate_layout(true);
    that.render_row_column(false);
    that.render_background();
    that.generate_detail();
  }

  that.draw_legend = function () {
    svg
      .append("text")
      .text("Base Learner")
      .attr("font-weight", "bold")
      .attr("font-size", font_size)
      .attr("text-anchor", "start")
      .attr("dy", "0.35em")
      .attr("x", + 0 )
      .attr("y", plot_margin.top - 7);
    svg
      .append("text")
      .text("Class")
      .attr("font-weight", "bold")
      .attr("font-size", font_size)
      .attr("text-anchor", "end")
      .attr("dy", "0.65em")
      .attr("x", row_width + row_name_width )
      .attr("y", plot_margin.top - col_id_offset - col_height - 10);
    svg
      .append("text")
      .text("Confidence")
      .attr("font-weight", "bold")
      .attr("font-size", font_size)
      .attr("text-anchor", "end")
      .attr("dy", "0.3em")
      .attr("x", row_width + row_name_width )
      .attr("y", plot_margin.top - col_id_offset);

    d3.select("#row-mode-svg").on("click", that.toggle_row_mode);


    const pad_color = '#f6f6fb'
    const pad_fontsize = (d3.select("#matrix svg").attr("width") - 10) / 59;

    const pad = svg
      .select("#legend")
      .append("g")
      .attr("id", "legend-pad")
      .attr("transform", `translate(${0},${that.layout.height + 30})`);

    const _margin = 0.3;
    const rect2_layout = {
      width: 23 * pad_fontsize,
      height: pad_fontsize * (2 + 6 * _margin),
      y1: (1 + 2 * _margin) * pad_fontsize,
      y2: (2 + 4 * _margin) * pad_fontsize,
      x1: 20,
      x2: 21.3 * pad_fontsize,
      cbox_size: pad_fontsize,
    }
    const rect2 = pad
      .append("g")
      .attr("id", "rect2")
      .attr("transform", `translate(${0},${0})`);
    rect2.html(`<svg xmlns="http://www.w3.org/2000/svg" width="${rect2_layout.width}" height="${rect2_layout.height}" viewBox="0 0 427.64 70.65"><defs><style>.cls-1,.cls-14,.cls-15,.cls-2,.cls-9{fill:#f3f4f9;}.cls-14,.cls-2,.cls-9{stroke:#5b5b5b;}.cls-2{stroke-width:0.38px;}.cls-3{fill:#5b5b5b;}.cls-4{fill:#212531;stroke:#212531;stroke-width:0.83px;}.cls-16,.cls-5{fill:#fff;}.cls-6{fill:#dadceb;}.cls-7{fill:#c9cce1;}.cls-10,.cls-12,.cls-13,.cls-8{isolation:isolate;}.cls-8{font-size:12.4px;}.cls-10,.cls-12,.cls-8{font-family:ArialMT, Arial;}.cls-9{stroke-width:0.39px;}.cls-10{font-size:12.93px;}.cls-11{letter-spacing:-0.06em;}.cls-12{font-size:18.59px;}.cls-14{stroke-width:0.39px;}.cls-15{stroke:#9095b2;stroke-width:0.86px;}.cls-16{fill-opacity:0;}</style></defs><title>cluster-legend</title><g id="图层_2" data-name="图层 2"><g id="图层_1-2" data-name="图层 1"><rect class="cls-1" width="427.64" height="70.65"/><path class="cls-2" d="M346.61,40.51h77.22a1.55,1.55,0,0,1,1.39,1.66v16.2A1.54,1.54,0,0,1,423.83,60H346.61a1.54,1.54,0,0,1-1.39-1.65V42.17A1.54,1.54,0,0,1,346.61,40.51Z"/><path class="cls-2" d="M346.61,12.64h77.22a1.55,1.55,0,0,1,1.39,1.66V30.5a1.54,1.54,0,0,1-1.39,1.65H346.61a1.54,1.54,0,0,1-1.39-1.65V14.3A1.54,1.54,0,0,1,346.61,12.64Z"/><circle class="cls-3" cx="343.04" cy="50.27" r="3.31"/><circle class="cls-3" cx="343.04" cy="22.4" r="3.31"/><rect class="cls-3" x="342.22" y="22.4" width="1.65" height="27.87"/><rect class="cls-4" x="347.79" y="18.27" width="8.26" height="8.26" rx="0.83"/><path class="cls-5" d="M355,19.85l-.54-.72a.07.07,0,0,0-.13,0h0L351,23.62l-1.71-2.3a.08.08,0,0,0-.14,0h0l-.54.72a.21.21,0,0,0,0,.19L351,25.32a.07.07,0,0,0,.08,0,.08.08,0,0,0,.07,0L355,20a.17.17,0,0,0,0-.19Z"/><rect class="cls-6" x="358.66" y="12.87" width="33.83" height="19.12"/><rect class="cls-7" x="390.26" y="12.87" width="3.24" height="19.12"/><text class="cls-8" transform="translate(359.77 26.74)">BL-tiered-2</text><path class="cls-9" d="M153.53,5.53h76.56a1.59,1.59,0,0,1,1.38,1.73v16.9a1.59,1.59,0,0,1-1.38,1.73H153.53a1.58,1.58,0,0,1-1.37-1.73V7.26A1.58,1.58,0,0,1,153.53,5.53Z"/><text class="cls-8" transform="translate(359.77 54.61)">BL-tiered-5</text><path class="cls-9" d="M152.84,6.33h76.55a1.59,1.59,0,0,1,1.38,1.73V25a1.59,1.59,0,0,1-1.38,1.73H152.84A1.58,1.58,0,0,1,151.46,25V8.06A1.58,1.58,0,0,1,152.84,6.33Z"/><path class="cls-9" d="M152.15,7.2H228.7a1.58,1.58,0,0,1,1.38,1.72v16.9a1.58,1.58,0,0,1-1.38,1.73H152.15a1.58,1.58,0,0,1-1.38-1.73V8.92A1.57,1.57,0,0,1,152.15,7.2Z"/><text class="cls-10" transform="translate(155.54 21.9)">(3) C-mini-<tspan class="cls-11" x="61.06" y="0">A</tspan></text><text class="cls-12" transform="translate(4 22.26)">Collapsed cluster</text><g class="cls-13"><path d="M253.27,31.43V18.12h9.62v1.57H255v4.08h7.36v1.56H255v4.53h8.17v1.57Z"/><path d="M264.33,31.43l3.53-5-3.26-4.63h2l1.48,2.26c.28.43.5.79.67,1.08.27-.4.51-.75.74-1.06l1.62-2.28h2l-3.33,4.54,3.59,5.1h-2l-2-3-.52-.8-2.54,3.8Z"/><path d="M274.72,35.13V21.79h1.49V23a3.62,3.62,0,0,1,1.19-1.1,3.22,3.22,0,0,1,1.61-.37,3.75,3.75,0,0,1,2.17.64A3.88,3.88,0,0,1,282.61,24a6.95,6.95,0,0,1-.05,5.2,4,4,0,0,1-3.67,2.45,3.07,3.07,0,0,1-1.47-.35,3.41,3.41,0,0,1-1.07-.87v4.7Zm1.48-8.47a4.2,4.2,0,0,0,.75,2.75,2.3,2.3,0,0,0,1.83.89,2.33,2.33,0,0,0,1.86-.92,4.33,4.33,0,0,0,.78-2.85,4.23,4.23,0,0,0-.76-2.76,2.28,2.28,0,0,0-1.81-.92,2.36,2.36,0,0,0-1.85,1A4.38,4.38,0,0,0,276.2,26.66Z"/><path d="M291.35,30.24a6.08,6.08,0,0,1-1.75,1.09,5,5,0,0,1-1.8.32,3.49,3.49,0,0,1-2.44-.78,2.56,2.56,0,0,1-.85-2,2.61,2.61,0,0,1,.32-1.3,2.73,2.73,0,0,1,.84-.94,4.09,4.09,0,0,1,1.18-.53,10.66,10.66,0,0,1,1.45-.25,14.45,14.45,0,0,0,2.92-.56v-.43a1.79,1.79,0,0,0-.46-1.4,2.74,2.74,0,0,0-1.86-.56,2.85,2.85,0,0,0-1.7.41,2.4,2.4,0,0,0-.81,1.43l-1.6-.22a3.84,3.84,0,0,1,.72-1.66,3.14,3.14,0,0,1,1.44-1,6.38,6.38,0,0,1,2.19-.34,5.84,5.84,0,0,1,2,.29,2.62,2.62,0,0,1,1.14.73,2.65,2.65,0,0,1,.51,1.11,9.84,9.84,0,0,1,.08,1.51v2.18a23.31,23.31,0,0,0,.1,2.88,3.6,3.6,0,0,0,.42,1.16h-1.71A3.53,3.53,0,0,1,291.35,30.24Zm-.13-3.65a12.32,12.32,0,0,1-2.67.62,5.49,5.49,0,0,0-1.43.33,1.35,1.35,0,0,0-.64.53,1.42,1.42,0,0,0,.27,1.86,2.1,2.1,0,0,0,1.44.44,3.33,3.33,0,0,0,1.68-.42A2.51,2.51,0,0,0,291,28.82a3.81,3.81,0,0,0,.27-1.63Z"/><path d="M295.4,31.43V21.79h1.47v1.37a3.47,3.47,0,0,1,3.07-1.59,4,4,0,0,1,1.6.31,2.59,2.59,0,0,1,1.1.83,3.18,3.18,0,0,1,.51,1.2,9.49,9.49,0,0,1,.09,1.59v5.93H301.6V25.56a4.33,4.33,0,0,0-.19-1.49,1.6,1.6,0,0,0-.67-.79A2.25,2.25,0,0,0,299.6,23a2.68,2.68,0,0,0-1.81.66,3.28,3.28,0,0,0-.75,2.51v5.27Z"/><path d="M312,31.43V30.21a3,3,0,0,1-2.7,1.44,3.75,3.75,0,0,1-2.12-.64,4.22,4.22,0,0,1-1.5-1.77,6.22,6.22,0,0,1-.53-2.62,6.87,6.87,0,0,1,.48-2.62,3.68,3.68,0,0,1,1.45-1.8,3.82,3.82,0,0,1,2.15-.63,3.14,3.14,0,0,1,1.55.37,3.22,3.22,0,0,1,1.11,1V18.12h1.62V31.43Zm-5.17-4.81a4.2,4.2,0,0,0,.78,2.77,2.36,2.36,0,0,0,1.84.91,2.3,2.3,0,0,0,1.82-.87,4.06,4.06,0,0,0,.75-2.68,4.51,4.51,0,0,0-.76-2.9,2.34,2.34,0,0,0-1.88-.93,2.29,2.29,0,0,0-1.82.89A4.4,4.4,0,0,0,306.83,26.62Z"/><path d="M322.68,28.33l1.69.2a4.12,4.12,0,0,1-1.48,2.3,5,5,0,0,1-6.11-.49,5,5,0,0,1-1.24-3.65,5.37,5.37,0,0,1,1.25-3.78A4.27,4.27,0,0,1,320,21.57a4.12,4.12,0,0,1,3.16,1.32,5.2,5.2,0,0,1,1.23,3.7c0,.1,0,.24,0,.44h-7.19a3.68,3.68,0,0,0,.9,2.43,2.66,2.66,0,0,0,2,.84,2.49,2.49,0,0,0,1.54-.47A3.17,3.17,0,0,0,322.68,28.33Zm-5.36-2.65h5.38a3.21,3.21,0,0,0-.62-1.82,2.5,2.5,0,0,0-2-.95,2.6,2.6,0,0,0-1.89.76A2.91,2.91,0,0,0,317.32,25.68Z"/><path d="M332.68,31.43V30.21a3,3,0,0,1-2.7,1.44,3.75,3.75,0,0,1-2.12-.64,4.22,4.22,0,0,1-1.5-1.77,6.22,6.22,0,0,1-.53-2.62,6.87,6.87,0,0,1,.48-2.62,3.8,3.8,0,0,1,1.45-1.8,3.84,3.84,0,0,1,2.15-.63,3.23,3.23,0,0,1,2.66,1.33V18.12h1.62V31.43Zm-5.17-4.81a4.2,4.2,0,0,0,.78,2.77,2.36,2.36,0,0,0,1.85.91,2.32,2.32,0,0,0,1.82-.87,4.06,4.06,0,0,0,.75-2.68,4.51,4.51,0,0,0-.77-2.9,2.34,2.34,0,0,0-1.88-.93,2.29,2.29,0,0,0-1.82.89A4.46,4.46,0,0,0,327.51,26.62Z"/><path d="M269.65,50.21l1.6.21A4.11,4.11,0,0,1,269.9,53a3.9,3.9,0,0,1-2.66.94,4.14,4.14,0,0,1-3.18-1.29A5.28,5.28,0,0,1,262.85,49a6.83,6.83,0,0,1,.52-2.74A3.6,3.6,0,0,1,265,44.47a4.66,4.66,0,0,1,2.3-.59,4,4,0,0,1,2.57.8,3.68,3.68,0,0,1,1.28,2.25l-1.59.25a2.62,2.62,0,0,0-.8-1.46,2.08,2.08,0,0,0-1.4-.49,2.52,2.52,0,0,0-2,.88,4.16,4.16,0,0,0-.78,2.8,4.29,4.29,0,0,0,.75,2.82,2.41,2.41,0,0,0,1.94.89,2.32,2.32,0,0,0,1.61-.59A3,3,0,0,0,269.65,50.21Z"/><path d="M272.61,53.74V40.43h1.64V53.74Z"/><path d="M283.1,53.74V52.33A3.55,3.55,0,0,1,280,54a3.84,3.84,0,0,1-1.59-.33,2.61,2.61,0,0,1-1.1-.82,3.1,3.1,0,0,1-.51-1.21,9,9,0,0,1-.1-1.53v-6h1.64v5.35a9.12,9.12,0,0,0,.1,1.72,1.68,1.68,0,0,0,.65,1,2,2,0,0,0,1.24.37,2.61,2.61,0,0,0,1.38-.38,2.09,2.09,0,0,0,.91-1,5.09,5.09,0,0,0,.27-1.88V44.1h1.63v9.64Z"/><path d="M286.47,50.86l1.61-.25a2.29,2.29,0,0,0,.76,1.49,2.69,2.69,0,0,0,1.74.52,2.58,2.58,0,0,0,1.67-.46,1.4,1.4,0,0,0,.55-1.08,1,1,0,0,0-.49-.87,6.66,6.66,0,0,0-1.67-.55,16.15,16.15,0,0,1-2.49-.79,2.46,2.46,0,0,1-1.11-3.4,2.62,2.62,0,0,1,.8-.92,3.5,3.5,0,0,1,1-.47,5,5,0,0,1,1.41-.2,5.5,5.5,0,0,1,2,.33,2.74,2.74,0,0,1,1.27.88,3.49,3.49,0,0,1,.56,1.5l-1.6.21a1.74,1.74,0,0,0-.63-1.16,2.28,2.28,0,0,0-1.47-.41,2.67,2.67,0,0,0-1.61.37,1.09,1.09,0,0,0-.48.87.92.92,0,0,0,.2.57,1.41,1.41,0,0,0,.63.44c.16.06.64.2,1.44.41a21.56,21.56,0,0,1,2.42.76,2.57,2.57,0,0,1,1.08.86,2.48,2.48,0,0,1,.38,1.4,2.73,2.73,0,0,1-.47,1.54,3.08,3.08,0,0,1-1.38,1.11,4.87,4.87,0,0,1-2,.4,4.56,4.56,0,0,1-2.87-.78A3.64,3.64,0,0,1,286.47,50.86Z"/><path d="M300,52.28l.23,1.44a5.86,5.86,0,0,1-1.23.15,2.85,2.85,0,0,1-1.38-.28,1.58,1.58,0,0,1-.69-.74,5.69,5.69,0,0,1-.2-1.93V45.37h-1.2V44.1h1.2V41.71l1.62-1V44.1H300v1.27h-1.65V51a2.8,2.8,0,0,0,.09.9.65.65,0,0,0,.28.31,1.08,1.08,0,0,0,.56.12A5.73,5.73,0,0,0,300,52.28Z"/><path d="M308.18,50.64l1.69.2a4.07,4.07,0,0,1-1.48,2.3,5,5,0,0,1-6.11-.48A5.09,5.09,0,0,1,301,49a5.33,5.33,0,0,1,1.25-3.77,4.24,4.24,0,0,1,3.25-1.35,4.11,4.11,0,0,1,3.16,1.32,5.21,5.21,0,0,1,1.23,3.7c0,.1,0,.24,0,.44h-7.19a3.68,3.68,0,0,0,.9,2.43,2.69,2.69,0,0,0,2,.85,2.5,2.5,0,0,0,1.54-.48A3,3,0,0,0,308.18,50.64ZM302.82,48h5.38a3.31,3.31,0,0,0-.61-1.82,2.52,2.52,0,0,0-2-.94,2.59,2.59,0,0,0-1.89.75A3,3,0,0,0,302.82,48Z"/><path d="M311.91,53.74V44.1h1.47v1.46a3.94,3.94,0,0,1,1-1.35,1.77,1.77,0,0,1,1.05-.33,3.15,3.15,0,0,1,1.67.53l-.56,1.51a2.4,2.4,0,0,0-1.2-.35,1.61,1.61,0,0,0-1,.32,1.81,1.81,0,0,0-.61.9,6.37,6.37,0,0,0-.27,1.9v5.05Z"/></g><text class="cls-12" transform="translate(4 57.92)"><tspan xml:space="preserve">Singleton  cluster</tspan></text><path class="cls-14" d="M151.81,42.07H229a1.59,1.59,0,0,1,1.39,1.73V60.7A1.59,1.59,0,0,1,229,62.43H151.81a1.59,1.59,0,0,1-1.39-1.73V43.8A1.59,1.59,0,0,1,151.81,42.07Z"/><rect class="cls-15" x="155.34" y="47.94" width="8.62" height="8.62" rx="0.86"/><path class="cls-16" d="M162.89,49.59l-.56-.75a.08.08,0,0,0-.14,0h0l-3.47,4.68-1.79-2.39a.08.08,0,0,0-.14,0h0l-.56.75a.17.17,0,0,0,0,.19l2.4,3.23a.09.09,0,0,0,.09,0,.08.08,0,0,0,.07,0l4.1-5.51a.17.17,0,0,0,0-.19Z"/><text class="cls-10" transform="translate(167.84 56.78)">BL-mini-5</text><rect class="cls-15" x="347.61" y="45.94" width="8.62" height="8.62" rx="0.86"/><line class="cls-9" x1="152.15" y1="7.2" x2="228.7" y2="7.2"/></g></g></svg>`)


    const rect3_layout = {
      width: 23 * pad_fontsize,
      height: pad_fontsize * (2 + 6 * _margin),
      y1: (1 + 2 * _margin) * pad_fontsize,
      y2: (2 + 4 * _margin) * pad_fontsize,
      x1: 20,
      x2: 13.5 * pad_fontsize,
      circle_size: pad_fontsize * 0.65,
    }
    const rect3 = pad
      .append("g")
      .attr("id", "rect3")
      .attr("transform", `translate(${0},${pad_fontsize + rect2_layout.height})`);
    rect3
      .append("rect")
      .attr("fill", pad_color)
      .attr("width", rect3_layout.width)
      .attr("height", rect3_layout.height)
    const vals = [0.1,0.2,0.3,0.4,0.5]
    const balls = rect3
      .selectAll(".legend-ball")
      .data(vals)
      .enter()
      .append("circle")
      .classed("legend-ball", true)
      .attr("cx", (d, i) => rect3_layout.x2 + 3 * i * rect3_layout.circle_size)
      .attr("cy", (1.5 + _margin) * rect3_layout.circle_size)
      .attr("r", rect3_layout.circle_size)
      .attr("fill", gray_scale)
      .attr("stroke", (d, i) => (i == 0 ? "#bbbbbb" : pad_color));
    const balls_text = rect3
      .selectAll(".legend-ball-text")
      .data(vals)
      .enter()
      .append("text")
      .text((d) => d)
      .attr("font-size", pad_fontsize)
      .attr("x", (d, i) => rect3_layout.x2 + 3 * i * rect3_layout.circle_size)
      .attr("y", rect3_layout.y2)
      .attr("text-anchor", "middle");
    draw_text(rect3, `Difference between`, rect3_layout.x1, rect3_layout.y1, pad_fontsize, {
      h_anchor: "start",
      v_anchor: "above",
    });
    draw_text(rect3, `learner and ensemble`, rect3_layout.x1, rect3_layout.y2, pad_fontsize, {
      h_anchor: "start",
      v_anchor: "above",
    });

    const rect4_layout = {
      left: rect3_layout.width + pad_fontsize,
      width: 59 * pad_fontsize - rect3_layout.width - pad_fontsize,
      height: pad_fontsize * (8 + 2 * _margin),
      inner_width: 20 * pad_fontsize,
      inner_left: 10,
      y1: (4.5) * pad_fontsize,
      y2: 6.2 * pad_fontsize,
    }
    const display_cluster = 4;
    const rect4 = pad
      .append("g")
      .attr("id", "rect4")
      .attr("transform", `translate(${rect4_layout.left},${0})`);

    rect4.html(`<svg xmlns="http://www.w3.org/2000/svg" width="${rect4_layout.width}" height="${rect4_layout.height}" viewBox="0 0 441.36 108.45"><defs><style>.ccls-1{fill:#f6f6fb;}.ccls-2,.ccls-8{fill:#f3e3b0;}.ccls-2,.ccls-3,.ccls-4{stroke:#e6be42;}.ccls-12,.ccls-3{fill:#e6be42;}.ccls-4,.ccls-9{fill:#edd280;}.ccls-5,.ccls-6{fill:none;stroke:#040000;}.ccls-5{stroke-width:0.5px;stroke-dasharray:5 5;}.ccls-11,.ccls-13,.ccls-7{isolation:isolate;fill:#040000;font-family:ArialMT, Arial;}.ccls-7{font-size:12.61px;}.ccls-10{fill:#bd9c35;}.ccls-11{font-size:10px;}.ccls-13{font-size:12px;}</style></defs><title>RECT4</title><g id="图层_2" data-name="图层 2"><g id="图层_1-2" data-name="图层 1"><rect class="ccls-1" width="441.36" height="108.45"/><rect class="ccls-2" x="10" y="56.75" width="25.22" height="21.44"/><rect class="ccls-3" x="35.22" y="56.75" width="189.15" height="21.44"/><rect class="ccls-4" x="224.37" y="56.75" width="37.83" height="21.44"/><rect class="ccls-5" x="172.36" y="55.75" width="37.83" height="24.44"/><line class="ccls-6" x1="213.46" y1="67.46" x2="277.2" y2="67.46"/><line class="ccls-6" x1="272.2" y1="64.46" x2="277.2" y2="67.46"/><line class="ccls-6" x1="272.2" y1="70.46" x2="277.2" y2="67.46"/><line class="ccls-6" x1="10" y1="16.39" x2="10" y2="29"/><line class="ccls-6" x1="224.37" y1="16.39" x2="224.37" y2="29"/><line class="ccls-6" x1="10" y1="22.7" x2="224.37" y2="22.7"/><text class="ccls-7" transform="translate(23.34 18.92)">Predicted to be of &quot;${LabelCluster.cluster2name[display_cluster]}&quot; by learner</text><text class="ccls-7" transform="translate(43.3 51.7)">Predicted to be of &quot;${LabelCluster.cluster2name[display_cluster]}&quot; by both</text><line class="ccls-6" x1="35.22" y1="31.53" x2="35.22" y2="44.14"/><line class="ccls-6" x1="224.37" y1="31.53" x2="224.37" y2="44.14"/><line class="ccls-6" x1="35.22" y1="37.83" x2="224.37" y2="37.83"/><text class="ccls-7" transform="translate(47.15 103.4)">Predicted to be of &quot;${LabelCluster.cluster2name[display_cluster]}&quot; by ensemble</text><line class="ccls-6" x1="35.22" y1="84.49" x2="35.22" y2="97.1"/><line class="ccls-6" x1="262.2" y1="84.49" x2="262.2" y2="97.1"/><line class="ccls-6" x1="35.22" y1="90.79" x2="262.2" y2="90.79"/><rect class="ccls-8" x="54.96" y="68.48" width="12.34" height="8.7"/><rect class="ccls-8" x="96.08" y="69.98" width="12.34" height="7.21"/><rect class="ccls-8" x="137.2" y="69.48" width="12.34" height="7.7"/><rect class="ccls-8" x="178.32" y="60.03" width="12.34" height="17.15"/><rect class="ccls-9" x="68.94" y="65.25" width="12.34" height="11.93"/><rect class="ccls-9" x="110.06" y="63.26" width="12.34" height="13.92"/><rect class="ccls-9" x="151.18" y="65.5" width="12.34" height="11.68"/><rect class="ccls-9" x="192.3" y="68.98" width="12.34" height="8.2"/><rect class="ccls-10" x="54.96" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="96.08" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="137.2" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="178.32" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="68.94" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="110.06" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="151.18" y="77.18" width="12.34" height="1.5"/><rect class="ccls-10" x="192.3" y="77.18" width="12.34" height="1.5"/><path class="ccls-6" d="M300,90.92v-5.5h54.58v5.5"/><line class="ccls-6" x1="299.99" y1="84.92" x2="299.99" y2="90.92"/><text class="ccls-11" transform="translate(290.26 101.02)">0.75</text><line class="ccls-6" x1="354.57" y1="84.92" x2="354.57" y2="90.92"/><text class="ccls-11" transform="translate(344.84 101.02)">1.00</text><rect class="ccls-12" x="299.49" y="31.53" width="54.58" height="47.4"/><rect class="ccls-8" x="309.32" y="36.07" width="16.37" height="40.86"/><rect class="ccls-9" x="327.87" y="57.38" width="16.37" height="19.54"/><rect class="ccls-10" x="309.32" y="76.92" width="16.37" height="2"/><rect class="ccls-10" x="327.87" y="76.92" width="16.37" height="2"/><line class="ccls-6" x1="322.69" y1="42.87" x2="364.98" y2="42.87"/><line class="ccls-6" x1="341.24" y1="67.15" x2="364.98" y2="67.15"/><text class="ccls-13" transform="translate(294.2 80.7) rotate(-90)">#samples</text><text class="ccls-7" transform="translate(371.36 95.84)">Confidence</text><text class="ccls-7" transform="translate(371.36 45.4)">Learner</text><text class="ccls-7" transform="translate(371.36 70.62)">Ensemble</text></g></g></svg>`)
  
  };

  that._draw_highlight_strip_row = function () {
    svg.select("#rows").select("g.highlight").selectAll("g#row-highlight").remove();
    const row = svg
      .select("#rows")
      .select("g.highlight")
      .selectAll("g#row-highlight")
      .data(that.current_highlight_row)
      .enter()
      .append("g")
      .attr("id", "row-highlight");
    row
      .append("rect")
      .attr("id", "row-highlight-stripe")
      .attr("fill", light_blue_gray)
      .attr("fill-opacity", 0.2)
      .attr("x", row_name_width*0.9)
      .attr(
        "y",
        (d) => that.global_scale.yscale * (that.rows[d].y + row_margin * that.rows[d].display_height)
      )
      .attr("width", (d) => that.layout.width + that.height_each_row+20)
      .attr(
        "height",
        (d) => that.global_scale.yscale * that.rows[d].display_height * (1 - 2 * row_margin)
      )
  };

  that._draw_highlight_strip_col = function (j) {
    console.log('draw stripe')
    const col = svg
      .select("#cols")
      .select("g.highlight")
      .selectAll("g#col-highlight")
      .data([j + 1])
      .enter()
      .append("g")
      .attr("id", "col-highlight");
    col
      .append("rect")
      .attr("id", "col-highlight-stripe")
      .attr("fill", light_blue_gray)
      .attr("fill-opacity", 0.2)
      .attr("y", 0)
      .attr("x", (j) => that.global_scale.xscale * (that.cols[j].x + col_margin * that.cols[j].display_width))
      .attr(
        "height",
        (j) =>
          col_height +
          col_id_offset +
          col_val_offset +
          that.layout.height
      )
      .attr("width", (j) => that.global_scale.xscale * that.cols[j].display_width * (1 - 2 * col_margin))
  };

  that.update_highlight_strip = function () {
    console.log('update stripe')
    svg
      .selectAll("#row-highlight-stripe")
      .transition()
      .duration(Animation.update)
      .attr("x", -80)
      .attr(
        "y",
        (d) =>
          that.global_scale.yscale *
          (that.layout.acc_Y[d] + row_margin * (that.layout.acc_Y_delta))
      )
      .attr("width", (d) => row_width + 80 + that.layout.width + that.height_each_row)
      .attr(
        "height",
        (d) => that.global_scale.yscale * (that.layout.acc_Y_delta) * (1 - 2 * row_margin)
      );


    svg
      .selectAll("#col-highlight-stripe")
      .transition()
      .duration(Animation.update)
      .attr("x", (j) => that.global_scale.xscale * (that.cols[j].x + col_margin * that.cols[j].display_width))
      .attr(
        "height",
        (j) => col_height + 40 + that.layout.height - that.global_scale.xscale * col_margin * that.cols[j].display_width
      )
      .attr("width", (j) => that.global_scale.xscale * that.cols[j].display_width * (1 - 2 * col_margin));
    svg
      .selectAll("#col-highlight-mark")
      .transition()
      .duration(Animation.update)
      .attr("x", (j) => that.global_scale.xscale * (that.cols[j].x + col_margin * that.cols[j].display_width))
      .attr("width", (j) => that.global_scale.xscale * that.cols[j].display_width * (1 - 2 * col_margin));
  };

  that.clean_highlight_strip = function () {
    that._draw_highlight_strip_row();
    svg.selectAll("g#col-highlight").remove();
  };

  that.refresh = function () {
    that.calculate_layout(false);
    that.render_row_column();
    that.render_background();
    that.generate_detail();
  };

  const basic_width = 100;
  const basic_height = 100;
  that.global_scale = { xscale: 1, yscale: 1 };

  that.generate_render_data = function () {
    const ensemble = Model.ensemble;
    const old_cells = that.cells;
    const old_cols = that.cols;
    const old_rows = that.rows;
    that.cells = [];
    that.cells_overall = [];
    that.N = LearnerCluster.n;
    that.K = LabelCluster.n;
    let maximum = 0;
    const col_widthes = FE(that.K).map(cluster => LabelCluster.get_width(cluster));
    const row_heights = FE(that.N).map(cluster => LearnerCluster.get_height(cluster));
    for (let i = 0; i < that.N; ++i) {
      const learner = LearnerCluster.get_min_learner(i);
      const key = ensemble.hashes[i];
      const attr = "pred";
      const info = LabelCluster.generate_single_cell_info(learner, null);
      for (let j = 0; j < that.K; ++j) {
        const label = LabelCluster.get_min_label(j);
        const cluster = j;
        let d_info = LabelCluster.generate_single_cell_info(learner, j);
        let d = {
          x: 0,
          y: 0,
          width: col_widthes[j],
          height: row_heights[i],
          display_width: col_widthes[j],
          display_height: row_heights[i],
          focus: false,
          i: i,
          j: j,
          learner: learner,
          label: label,
          cluster: cluster,
          id: `${learner}-${label}`,
          info: d_info,
          sum: d_info.clf1_idx.length + d_info.both_idx.length + d_info.clf2_idx.length,
          ensemble_num: d_info.both_idx.length + d_info.clf2_idx.length,
          barchart: false,
        };
        if (maximum < d.ensemble_num) maximum = d.ensemble_num;
        if (maximum < d.sum) maximum = d.sum;
        that.cells.push(d);
      }
      let d = {
        x: 0,
        y: 0,
        size: basic_height,
        display_size: basic_height,
        i: i,
        j: -1,
        id: `${learner}`,
        info: info,
        val: info.diff,
        idx: info.diff_idx,
        label: -1,
        cluster: -1,
        learner: learner,
      };
      that.cells_overall.push(d);
    }
    that.cells.forEach(
      (d) => {
        const alpha = 0.8
        d.inner_width = (d.sum ** 0.5) / (maximum ** 0.5) * alpha + (1 - alpha)
      }
    );
    if (old_cells.filter(d => d.barchart).length > 0) {
      old_cells.filter(d => d.barchart).forEach((old) => {
        that.cells.find(cell => cell.id == old.id).barchart = true;
      })
    }
    old_cells.forEach(old => {
      let cell = that.cells.find(cell => cell.id == old.id);
      if (cell) {
        cell.old_layout = old.old_layout;
        cell.layout = old.layout;
      }
    })

    that.rows = FE(that.N).map((i) => ({
      i: i,
      id: LearnerCluster.get_id(i),
      learner: LearnerCluster.get_min_learner(i),
      focus: false,
      show: true,
      cluster: i,
      hash: Model.ensemble.model_info[LearnerCluster.get_min_learner(i)].hash,
      display_height: that.cells[i * that.K].display_height,
      y: 0,
      info: Model.ensemble.model_info[LearnerCluster.get_min_learner(i)],
      selected: Model.ensemble.selected_clf_idxes.includes(LearnerCluster.get_min_learner(i)),
      selected_status: Model.ensemble.selected_clf_idxes.includes(LearnerCluster.get_min_learner(i)) ? 2 : 0,
      learner_name: LearnerCluster.learner2name[LearnerCluster.get_min_learner(i)],
      cluster_name: LearnerCluster.cluster2name[i],
    }));
    that.cols = FE(that.K).map((i) => ({
      id: LabelCluster.get_id(i),
      i: i,
      label: LabelCluster.get_min_label(i),
      cluster: i,
      focus: false,
      idx: LabelCluster.get_idx_by_cluster(i),
      col_val: LabelCluster.get_idx_by_cluster(i)
        .map((idx) => Model.ensemble.ensemble_info.margin[idx])
        .average(),
      col_val_coef: 1,
      display_width: that.cells[i].display_width,
      x: 0,
      label: LabelCluster.get_min_label(i),
      selected: true,
    }));
    that.cols.unshift({
      i: -1,
      idx: FE(DataLoader.state.N),
      col_val: FE(DataLoader.state.N)
        .map((idx) => Model.ensemble.ensemble_info.margin[idx])
        .average(),
      col_val_coef: 1,
      display_width: 0,
      x: 0,
      label: -2,
      cluster: -1,
      selected: true,
    });
    for (let old of old_cols) {
      let n = that.cols.find(col => col.id == old.id);
      if (n) {
        n.selected = old.selected;
        n.display_width = old.display_width;
        n.old_display_width = old.old_display_width;
      }
    }
    for (let old of old_rows) {
      let n = that.rows.find(row => row.id == old.id);
      if (n) {
        n.selected = old.selected;
        n.selected_status = old.selected_status
        n.show = old.show;
        n.display_height = old.display_height;
        n.old_display_height = old.old_display_height;
      }
    }
  };
  that.calculate_layout = function (first_time = false) {
    for (let i = 0; i < that.N; ++i) {
      that.cells_overall[i].display_height = that.rows[i].display_height;
      for (let j = 0; j < that.K; ++j) {
        that.cells[i * that.K + j].display_width = that.cols[j+1].display_width;
        that.cells[i * that.K + j].display_height = that.rows[i].display_height;
      }
    }
    let X = FE(that.K).map((idx) => that.cells[idx].display_width);
    let acc_X = X.reduce((a, x, i) => [...a, x + a[i]], [0]);
    let Y = FE(that.N).map((idx) => that.cells[idx * that.K].display_height);
    let acc_Y = Y.reduce((a, x, i) => [...a, x + a[i]], [0]);
    that.svg_width = that.svg_width ? that.svg_width : div.node().getBoundingClientRect().width - div_margin.left - div_margin.right;
    that.svg_height = that.svg_height ? that.svg_height : div.node().getBoundingClientRect().height - div_margin.top - div_margin.bottom;
    const svg_width = that.svg_width;
    const svg_height = that.svg_height;
    svg.attr("width", svg_width).attr("height", svg_height);
    plot_margin.bottom = plot_margin.bottom_ratio * svg_height;
    const height = parseInt(svg_height) - plot_margin.top - plot_margin.bottom;
    const height_each_row = height / Model.models.length;
    that.height_each_row = height_each_row;
    const width = parseInt(svg_width) - plot_margin.left - plot_margin.right - height_each_row;

    let new_Y = FE(that.N).map((i) => that.rows[i].display_height)
    acc_Y = new_Y.reduce((a, x, i) => [...a, x + a[i]], [0]);


    acc_X = X.reduce((a, x, i) => [...a, x + a[i]], [0]);

    for (let i = 0; i < that.N; ++i) {
      for (let j = 0; j < that.K; ++j) {
        that.cells[i * that.K + j].x = acc_X[j];
        that.cells[i * that.K + j].y = acc_Y[i];
        that.cols[j + 1].x = acc_X[j];
      }
      that.rows[i].y = acc_Y[i];
      that.cells_overall[i].y = acc_Y[i];
    }
    that.global_scale.xscale = width / Math.max(...acc_X);
    that.global_scale.yscale = height / Math.max(...acc_Y);
    console.log(svg_height, height, height_each_row, acc_Y, that.global_scale.yscale)
    that.global_scale.square_scale = 99999999;
    for (let i = 0; i < that.N; ++i) {
      for (let j = 0; j < that.K; ++j) {
        let d = that.cells[i * that.K + j];
        d.layout_width = that.global_scale.xscale * d.display_width;
        d.layout_height = that.global_scale.yscale * d.display_height;
        d.min_size = Math.min(d.layout_width, d.layout_height);
        d.r = (d.min_size * (1 - 2 * margin)) / 2;
        that.global_scale.square_scale = Math.min(
          that.global_scale.square_scale,
          (d.min_size * (1 - 2 * margin)) / (d.val + 0.00001)
        );
      }
      let d = that.cells_overall[i];
      d.layout_height = that.global_scale.yscale * d.display_size;
      d.layout_width = that.global_scale.xscale * d.display_size;
      d.min_size = Math.min(d.layout_width, d.layout_height);
      d.r = (d.min_size * (1 - 2 * 0.15));
    }
    that.cells.forEach((d) => (d.square_size = that.global_scale.square_scale * d.val * (1 - 2 * margin)));
    that.layout = {
      width: width,
      height: height,
      acc_X: acc_X,
      acc_Y: acc_Y,
    };
    svg
      .select("#matrix")
      .transition()
      .duration(first_time ? 0 : Animation.update)
      .attr("transform", `translate(${plot_margin.left + height_each_row},${plot_margin.top})`);
    svg
      .select("#rows")
      .transition()
      .duration(first_time ? 0 : Animation.update)
      .attr("transform", `translate(${0},${plot_margin.top})`);
    svg
      .select("#cols")
      .transition()
      .duration(first_time ? 0 : Animation.update)
      .attr("transform", `translate(${plot_margin.left + height_each_row},${col_top})`);
    svg
      .select("#legend")
      .transition()
      .duration(first_time ? 0 : Animation.update)
      .attr("transform", `translate(${0},${plot_margin.top})`);
    if (first_time) {
      that.cells.forEach(that._update_layout);
      that.cells_overall.forEach(that._update_layout);
    }
    that.cols[0].x = (-that.height_each_row * 0.8 + first_col_offset) / that.global_scale.xscale;
    that.cols[0].display_width = that.height_each_row * 0.8 / that.global_scale.xscale;
    for (let cell of that.cells_overall) cell.display_width = that.cols[0].display_width;
  };

  that.base_learner_select_click = function (d) {
    d.selected_status = (d.selected_status !== 0) ? 0 : 2;
    if (d.selected_status === 2 && !that.confirm_idxes.includes(d.i)) {
      that.confirm_idxes.push(d.i);
    }
    if (d.selected_status === 0 && that.confirm_idxes.includes(d.i)) {
      that.confirm_idxes.splice(that.confirm_idxes.indexOf(d.i), 1);
    }
    d.selected = d.selected_status !== 0;
    d3.selectAll(".row-cbox")
    .attr("fill", (d) => CHECK_FILL[d.selected_status])
    .attr("stroke", (d) => CHECK_STROKE[d.selected_status]);
    d3.selectAll(".row-cbox-glyph").attr("fill-opacity", (d) => d.selected_status === 0 ? 0 : 1);
    d3.selectAll(".weight-btn").style("opacity", (d) => d.selected_status === 0 ? 0 : 1)
    .style("pointer-events", (d) => d.selected_status === 0 ? "none" : "default")
    d3.selectAll(".up-btn").attr('transform', (d,i) => `translate(0,2)`)
    d3.selectAll(".down-btn").attr('transform', (d,i) => `translate(0,10)`)
    d3.selectAll(".foreign").style("opacity", (d) => d.selected_status === 0 ? 0 : 1)
    console.log('base learner click')
    let tmp = [].concat(that.rows).concat(that.cells_overall).concat(that.cells);
    tmp.forEach(d => d.old_location = d.y * that.global_scale.yscale)
    that.calculate_layout(false);
    tmp.forEach(d => d.xoffset = d.y * that.global_scale.yscale > d.old_location + 20 ? 20 :  
      d.y * that.global_scale.yscale < d.old_location - 20 ? 0 : 0);
    that.update_rows()
    tmp.forEach(d => d.xoffset = 0);
  };

  that.cluster_hide_click = function(d) {
    const col = that.cols.find(col => col.id == d.id);
    col.selected = !col.selected;
    const width = col.selected ? LabelCluster.get_width(col.cluster) * (Matrix.cells.filter(dd => dd.j == col.cluster && dd.barchart).length + 1) : min_width;
    col.display_width = width
    that.calculate_layout(false);
    that.update_cols(col.cluster);
    Scatterplot.toggle_cluster(LabelCluster.origin_label_cluster[col.label], col.selected);
  }

  that.learner_hide_click = function(d) {
    const row = that.rows.find(row => row.id == d.id);
    row.show = !row.show;
    const height = row.show ? LearnerCluster.get_height(row.cluster) : min_height;
    row.display_height = height
    that.calculate_layout(false);
    that.render_row_column();
    that.adjust_row_loc();
    
    that.generate_detail();
    //that.update_rows_2(row.cluster);
  }

  that.update_rows = function () {
    //const cbox_size = that.height_each_row / 2;
    const cbox_size = 10;
    that.update_highlight_strip();
    const rows = svg.select("g#rows").selectAll("g.row")
    const first_cols = svg.select("g#matrix").selectAll("g.cell-overall")
    const staticCellSlc = svg.select("g#matrix").selectAll("g.cell")
    rows
        .transition()
        .duration(Animation.update / 4)
        .ease(d3.easeCubicIn)
        .attr("transform", (d) => `translate(${d.xoffset},${d.old_location})`)
        .transition()
        .duration(Animation.update / 2)
        .ease(d3.easeLinear)
        .attr("transform", (d) => `translate(${d.xoffset},${d.y * that.global_scale.yscale})`)
        .transition()
        .duration(Animation.update / 4)
        .ease(d3.easeCubicOut)
        .attr("transform", (d) => `translate(${0},${d.y * that.global_scale.yscale})`)
    rows.selectAll(".foreign").attr("opacity", d => d.selected ? 1 : 0)
    
    
    first_cols
    .transition()
    .duration(Animation.update / 4)
    .ease(d3.easeCubicIn)
    .attr("transform", (d) => `translate(${first_col_offset+d.xoffset},${d.old_location})`)
    .transition()
    .duration(Animation.update / 2)
    .ease(d3.easeLinear)
    .attr("transform", (d) => `translate(${first_col_offset+d.xoffset},${d.y * that.global_scale.yscale})`)
    .transition()
    .duration(Animation.update / 4)
    .ease(d3.easeCubicOut)
    .attr("transform", (d) => `translate(${first_col_offset},${d.y * that.global_scale.yscale})`)
  
    
    staticCellSlc
    .transition()
    .duration(Animation.update / 4)
    .ease(d3.easeCubicIn)
    .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale + d.xoffset},${d.old_location})`)
    .transition()
    .duration(Animation.update / 2)
    .ease(d3.easeLinear)
    .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale + d.xoffset},${d.y * that.global_scale.yscale})`)
    .transition()
    .duration(Animation.update / 4)
    .ease(d3.easeCubicOut)
    .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${d.y * that.global_scale.yscale})`)


};

that.update_cells = function() {
  const staticCellSlc = svg.select("g#matrix").selectAll("g.cell");
  staticCellSlc
  .transition()
  .duration(Animation.update)
  .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${d.y * that.global_scale.yscale})`)
}

  that.update_cols = function (change_cluster) {
    let col_idx = that.cols.findIndex(col => col.cluster === change_cluster);
    const opacity = change_cluster  == -1 ? 1 : that.cols[col_idx].selected ? 1 : 0;
    const cbox_size = 10;
    that.update_highlight_strip();
    const cols = svg.select("g#cols").selectAll("g.col").data(that.cols, d => d.id);
    cols
      .transition()
      .duration(Animation.update)
      .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${0})`);

    cols
      .selectAll("rect.col-bar")
      .transition()
      .duration(Animation.update)
      .attr("width", (d) => d.display_width * that.global_scale.xscale * (1 - 2 * col_margin))
      .attr("x", (d) => d.display_width * that.global_scale.xscale * col_margin)
      .filter(d => d.cluster === change_cluster)
      .style("pointer-events", opacity==0?"none":"auto")

    cols
    .selectAll(".col-hide-glyph")
    .attr("d", (d,i) => d.selected ? UNHIDE : HIDE)
    .transition()
    .duration(Animation.update)
    .attr("transform", d => d.selected ? `translate(${(d.display_width * that.global_scale.xscale) / 2-5.25}, ${-30}) scale(0.012,0.012)`
    : `translate(${(d.display_width * that.global_scale.xscale) / 2-2.2}, ${-30}) scale(0.005,0.012)`)

    cols
      .selectAll("text.col-id")
      .transition()
      .duration(Animation.update)
      .attr("transform", d => `translate(${d.display_width * that.global_scale.xscale/2},2)`)
      .filter(d => d.cluster === change_cluster)
      .style("opacity", opacity);
    cols
      .selectAll("text.col-val")
      .transition()
      .duration(Animation.update)
      .attr("x", (d) => (d.display_width * that.global_scale.xscale) / 2)
      .text((d) => Number(d.col_val).toFixed(d.i == -1 ? 2 : 3).substr(1))
      .filter(d => d.cluster === change_cluster)
      .style("opacity", opacity);
    that.update_cells();
    const staticCellSlc = svg.select("g#matrix").selectAll("g.cell");
    staticCellSlc.filter(d => d.cluster === change_cluster)
      .style("pointer-events", opacity==0?"none":"auto")
    that.render_label_bg();
    that.render_learner_bg();
    that.generate_detail();
  };

  that.label_click = function(d) {
    clearTimeout(that.scatter_timer)
    that.scatter_timer = setTimeout(() =>{
      let col = that.cols.find(col => col.cluster === d.cluster);
      if (col.selected)  {
        if (that.current_select_box !== null) {
          if (col.focus) {
            [other_d, other_g] = that.current_select_box;
            other_d.focus = false;
            other_g.attr("stroke", "white");
            that.current_select_box = null;
            DataLoader.unselect("matrix-col");
            that.highlight();
          } else {
            [other_d, other_g] = that.current_select_box;
            other_d.focus = false;
            other_g.attr("stroke", "white");
            that.current_select_box = [col, d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster)];
            [current_d, current_g] = that.current_select_box;
            current_d.focus = true;
            current_g.attr("stroke", "black");
            DataLoader.select(col.idx, "matrix-col");
          }
        } else {
          that.current_select_box = [col, d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster)];
          [current_d, current_g] = that.current_select_box;
          current_d.focus = true;
          current_g.attr("stroke", "black");
          DataLoader.select(col.idx, "matrix-col");
        }
      } else {
        that.cluster_hide_click(col);
      }
    }, DOUBLE_CLICK_TIME);
  }

  that.render_label_bg = function() {
    let background_data = [];
    for (let i = LabelCluster.N - 1; i != -1; --i) {
      let cluster = LabelCluster.label_cluster[i]
      background_data.push({
        cluster: cluster,
        label: i,
        idx: LabelCluster.get_cluster_from_label(i)[1],
        origin_cluster: LabelCluster.origin_label_cluster[i],
        x: that.cols[cluster + 1].x * that.global_scale.xscale,
        width: that.cols[cluster + 1].display_width * that.global_scale.xscale,
        selected: that.cols[cluster+1].selected,
      })
    }

    function dragstarted(d) {
        d.dragstart = {startx: d3.event.x, starty: d3.event.y, text_transform:d3.selectAll(".col-id").filter(dd => dd.cluster === d.cluster).attr("transform")}
        console.log(d.dragstart);
        d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster).attr("stroke", "black");
        d3.selectAll(".col-id").filter(dd => dd.cluster === d.cluster)
        .attr("transform", `${d.dragstart.text_transform} translate(${d3.event.x - d.dragstart.startx},${d3.event.y - d.dragstart.starty})`)
    }
    function dragged(d) {
      d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster)
      .attr("transform", `translate(${d3.event.x - d.dragstart.startx},${d3.event.y - d.dragstart.starty})`)
      d3.selectAll(".col-id").filter(dd => dd.cluster === d.cluster)
      .attr("transform", `${d.dragstart.text_transform} translate(${d3.event.x - d.dragstart.startx},${d3.event.y - d.dragstart.starty})`)
    }
    function dragended(d) {
      function cancel() {
        d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster)
        .transition()
        .duration(500)
        .attr("transform", `translate(${0},${0})`)
        d3.selectAll(".col-id").filter(dd => dd.cluster === d.cluster)
        .transition()
        .duration(500)
        .attr("transform", `${d.dragstart.text_transform}`)
      }
      const mouse_dist_square = Math.pow(d3.event.x - d.dragstart.x, 2) + Math.pow(d3.event.y - d.dragstart.y, 2);
      if (mouse_dist_square < 100) {
        console.log("drag to click");
        cancel();
        that.label_click(d);
        return;
      }

      d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster).attr("stroke", "white");
      const x = +d3.select(this).attr("x") + d3.event.x - d.dragstart.startx;
      const y = +d3.select(this).attr("y") + d3.event.y - d.dragstart.starty;
      const tmp = that.cols.slice(1).map(d => ({dist: Math.abs(x - d.x * that.global_scale.xscale), label:d.label}));
      const min_dist = Math.min(...tmp.map(d => d.dist));
      if (min_dist > 25 || Math.abs(y + 12) > 25) {
        if (Math.abs(y + 12) > 25 && LabelCluster.get_cluster_type(d.cluster) === 1) {
          d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster)
          .attr("transform", `translate(${0},${0})`)
          let label_cluster = LabelCluster.origin_label_cluster.slice();
          label_cluster[d.label] = 100;
          LabelCluster.remake(label_cluster);
        } else {
          cancel();
        }
      } else {
        const min_col = tmp.find(d => d.dist === min_dist);
        if (LabelCluster.origin_label_cluster[min_col.label] === LabelCluster.origin_label_cluster[d.label]) {
          cancel();
        } else {
          d3.selectAll(".label-bg").filter(dd => dd.cluster === d.cluster)
          .attr("transform", `translate(${0},${0})`)
          let all_labels = LabelCluster.get_all_label(d.cluster);
          let label_cluster = LabelCluster.origin_label_cluster.slice();
          all_labels.forEach(l => label_cluster[l] = LabelCluster.origin_label_cluster[min_col.label]);
          LabelCluster.remake(label_cluster);
        }
      }
    }
    const drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    
    const background = svg.select("g#cols").selectAll(".label-bg").data(background_data, d=>d.label);
    background.enter().append("rect")
      .classed("label-bg", true)
      .on("mouseover", (d)=> {
        clearTimeout(that.scatter_timer)
        that.scatter_timer = setTimeout(() =>
          DataLoader.highlight(LabelCluster.get_idx_by_cluster(d.cluster)), 200)
        that._draw_highlight_strip_col(d.cluster);
      })
      .on("mouseout", d => {
        that.clean_highlight_strip();
        clearTimeout(that.scatter_timer)
        that.scatter_timer = setTimeout(() =>
          DataLoader.unhighlight()
        , 200)
      })
      .on("click", that.label_click)
      .on("dblclick",(d) => {
        clearTimeout(that.scatter_timer)
        let type = LabelCluster.get_cluster_type(d.cluster);
        if (type === 1) {
          LabelCluster.shrink_label(d.label);
        }
        if (type === 2) {
          LabelCluster.expand_label(d.label);
        }
       })
      .attr("fill", d => LabelCluster.dark_color[d.label])
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .attr("height", label_font_size * 4)
      .attr("width", (d) => d.width * (1 - 2 * col_margin))
      .attr("x", (d) => d.x + d.width * col_margin + d.idx * 1.5)
      .attr("y", (d) => -12 - d.idx * 2)
      .style("opacity", d => d.idx == 0 || d.selected ? 1 : 0);
    background
      .transition()
      .duration(Animation.update)
      .attr("width", (d) => d.width * (1 - 2 * col_margin))
      .attr("x", (d) => d.x + d.width * col_margin + d.idx * 1.5)
      .attr("y", (d) => -12 - d.idx * 2)
      .attr("fill", d => LabelCluster.dark_color[d.label])
      .style("opacity", d => d.idx == 0 || d.selected ? 1 : 0);
    background.call(drag);
    let glyph_data = background_data.filter(d => LabelCluster.get_cluster_type(d.cluster) === 1).sort((x,y) => y.cluster - x.cluster);
    const glyph = svg.select("g#cols").selectAll(".cluster-glyph").data(glyph_data, d => d.label);
    glyph.exit().remove();
    glyph.enter().append("circle").classed("cluster-glyph", true)
    .attr("fill", d => LabelCluster.dark_color[d.label])
    .attr("r", 4)
    .attr("cx", (d) => d.x + d.width / 2)
    .attr("cy", (d) => -15)
    .style("opacity", 0)
    .transition()
    .delay(that.first_time ? 0 : Animation.enterDelay)
    .duration(that.first_time ? 0 :  Animation.enter)
    .style("opacity", 1);
    glyph
    .transition()
    .duration(Animation.update)
    .attr("fill", d => LabelCluster.dark_color[d.label])
    .attr("cx", (d) => that.cols[d.cluster + 1].x * that.global_scale.xscale + that.cols[d.cluster + 1].display_width * that.global_scale.xscale / 2)
    
    let line_data = []
    for (let i = 1; i < glyph_data.length; ++i) {
      let lhs = glyph_data[i-1], rhs = glyph_data[i];
      if (lhs.origin_cluster !== rhs.origin_cluster) continue;
      let color = generate_linear_gradient(LabelCluster.dark_color[rhs.label], LabelCluster.dark_color[lhs.label])
      line_data.push({
        r: lhs.x + lhs.width / 2,
        l: rhs.x + rhs.width / 2,
        color: color,
        id: `${lhs.label}-${rhs.label}`
      })
      
    }
    const line = svg.select("g#cols").selectAll(".line-glyph").data(line_data, d => d.id);
    line.exit().remove();
    line.enter().append("rect").classed("line-glyph", true)
    .attr("fill", d => d.color)
    .attr("y", (d) => -16)
    .attr("height", (d) => 2)
    .attr("width", d => d.r - d.l)
    .attr("x", d => d.l)
    .style("opacity", 0)
    .transition()
    .delay(that.firsttime ? 0 : Animation.enterDelay)
    .duration(that.firsttime ? 0 : Animation.enter)
    .style("opacity", 1);
    line
    .transition()
    .duration(Animation.update)
    .attr("fill", d => d.color)
    .attr("x", d => d.l)
    .attr("width", d => d.r- d.l)
  }

  that.render_row_column = function (firsttime) {
    that.render_label_bg();
    that.render_learner_bg();
    const cbox_size = 10;

    that.update_highlight_strip();
    const rows = svg.select("g#rows").selectAll("g.row").data(that.rows, d => d.learner);
    rows.exit().remove();
    const rows_enter = rows
      .enter()
      .append("g")
      .classed("row", true)
      .attr("id", (d) => `row-${d.i}`)
      .attr("transform", (d) => `translate(${0},${d.y * that.global_scale.yscale})`);

    rows
      .transition()
      .duration(Animation.update)
      .attr("transform", (d) => `translate(${0},${d.y * that.global_scale.yscale})`);

    rows_enter
      .append("rect")
      .classed("row-bar-background", true)
      .attr("id", (d) => `row-bar-background-${d.i}`)
      .attr("x", 2 * cbox_size)
      .attr("width", -2 * cbox_size + row_name_width + row_width + that.layout.width + that.height_each_row)
      .attr("height", (d) => d.display_height * that.global_scale.yscale)
      .attr("fill-opacity", 0)
    rows
      .selectAll("rect.row-bar-background")
      .transition()
      .duration(Animation.update)
      .attr("height", (d) => d.display_height * that.global_scale.yscale);

    rows_enter.append("rect").style("opacity", 0).attr("fill", "red")
      .attr("x", 20)
      .attr("height", d => (d.display_height * that.global_scale.yscale))
      .attr("width", (d) => 115)
      .on("mouseover", function (d, i) {
        console.log('learner over', d3.mouse(this))
        const [mousex, mousey] = d3.mouse(this)
        if (22 < mousex && mousex < 133 && 4 < mousey && mousey < (d.display_height * that.global_scale.yscale)-4) return;
        
        Model.on_mouseover(d)
      })
      .on("mouseout", function (d) {
        console.log('learner out', d3.mouse(this))
        const [mousex, mousey] = d3.mouse(this)
        if (22 < mousex && mousex < 133 && 4 < mousey && mousey < (d.display_height * that.global_scale.yscale)-4) return;
        Model.on_mouseout(d)
      })
      .on("click", function (d) {
        const g = d3.select(this);
        Model.on_click(d, g);
      })
      .on("dblclick",(d) => {
        clearTimeout(that.scatter_timer)
        console.log('dblclick')
        let type = LearnerCluster.get_cluster_type(d.cluster);
        if (type === 1) {
          LearnerCluster.shrink_learner(d.learner);
        }
        if (type === 2) {
          LearnerCluster.expand_learner(d.learner);
        }
       });
    rows_enter
      .append("rect")
      .classed("row-cbox", true)
      .attr("x", cbox_size / 2 + cbox_xoffset+2)
      .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2 - cbox_size / 2)
      .attr("width", cbox_size)
      .attr("rx", 1)
      .attr("ry", 1)
      .attr("height", cbox_size)
      .attr("fill", (d) => CHECK_FILL[d.selected_status])
      .attr("stroke", (d) => CHECK_STROKE[d.selected_status])
      .attr("stroke-width", 1)
      .style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? "none" : "block")
      .on("click", that.base_learner_select_click)
      .style("opacity", 0)
      .transition()
      .delay(that.first_time ? 0 : Animation.enterDelay)
      .duration(that.first_time ? 0 : Animation.update)
      .style("opacity", 1);
    rows
      .select(".row-cbox")
      .transition()
      .duration(Animation.update)
      .attr("x", cbox_size / 2 + cbox_xoffset+2)
      .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2 - cbox_size / 2)
      .attr("width", cbox_size)
      .attr("rx", 1)
      .attr("ry", 1).style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? "none" : "block")

    rows_enter
      .append("path")
      .classed("row-cbox-glyph", true)
      .classed("check-glyph", true)
      .attr("d", CHECK)
      .attr("transform", d => `translate(${cbox_size/2+cbox_xoffset+cbox_size/10+2}, ${(d.display_height * that.global_scale.yscale) / 2 - cbox_size*0.8 / 2}) scale(${cbox_size/1750},${cbox_size/1350})`)
      .attr("fill", "white")
      .attr("fill-opacity", (d) => d.selected_status === 0 ? 0 : 1)
      .style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? "none" : "block")
      .style("opacity", 0)
      .transition()
      .delay(that.first_time ? 0 : Animation.enterDelay)
      .duration(that.first_time ? 0 : Animation.update)
      .style("opacity", 1);
    rows
      .select(".row-cbox-glyph")
      .transition()
      .duration(Animation.update)
      .attr("transform", d => `translate(${cbox_size/2+cbox_xoffset+cbox_size/10+2}, ${(d.display_height * that.global_scale.yscale) / 2 - cbox_size*0.8 / 2}) scale(${cbox_size/1750},${cbox_size/1350})`)
      .attr("fill-opacity", (d) => d.selected_status === 0 ? 0 : 1)
      .style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? "none" : "block")

    const weight_btns = rows_enter.append("g").classed("weight-btn", true)
      .attr('transform', d => `translate(${row_name_width*0.9},${(d.display_height * that.global_scale.yscale) / 2 - row_name_width*0.05})`)
      .style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 || !d.show  ? "none" : "block")
      .style("opacity", (d) => d.selected_status === 0 ? 0 : 1);
    weight_btns.append('path').classed("up-btn", true).attr('id', d=> `up-btn-${d.cluster}`).attr('d', GET_UP_TRIANGLE(8)).attr('fill','#989aac').attr('transform', d => `translate(0,2) `)
    .on('click', Matrix.increase_weight).style('cursor','pointer');
    weight_btns.append('path').classed("down-btn", true).attr('id', d=> `down-btn-${d.cluster}`).attr('d', GET_DOWN_TRIANGLE(8)).attr('fill','#989aac').attr('transform', d => `translate(0,10) `)
    .on('click', Matrix.decrease_weight).style('cursor','pointer');

    rows.select(".weight-btn")
      .transition()
      .duration(Animation.update)
      .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2 - cbox_size / 2)
      .style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 || !d.show  ? "none" : "block")
      .style("opacity", (d) => d.selected_status === 0 ? 0 : 1)
      .style("pointer-events", (d) => d.selected_status === 0 ? "none" : "default")
    rows.select(".up-btn").attr('transform', (d,i) => `translate(0,${2})`)
    rows.select(".down-btn").attr('transform', (d,i) => `translate(0,${10})`)
    rows_enter
      .append("path")
      .classed("row-hide-glyph", true)
      .on("click", that.learner_hide_click)
      .attr("d", (d,i) => d.show ? UNHIDE : HIDE)
      .attr("fill", "#666666")
      .attr("transform", d => `translate(${0}, ${(d.display_height * that.global_scale.yscale - (d.show ? 11 : 11)) / 2}) scale(0.012,${d.show ? 0.012 : 0.012})`)
      .style("opacity", 0)
      .transition()
      .delay(that.first_time ? 0 : Animation.enterDelay)
      .duration(that.first_time ? 0 : Animation.update)
      .style("opacity", 1);;
    rows
      .select(".row-hide-glyph")
      .on("click", that.learner_hide_click)
      .attr("d", (d,i) => d.show ? UNHIDE : HIDE)
      .transition()
      .duration(Animation.update)
      .attr("transform", d => `translate(${0}, ${(d.display_height * that.global_scale.yscale - (d.show ? 11 : 11)) / 2}) scale(0.012,${d.show ? 0.012 : 0.012})`);
      
    const local_y_margin = 0.15;
    const foreign_objects = rows_enter.append('foreignObject').classed("foreign",true).style("pointer-events", "none")
      .attr("x", row_name_width * 0.25)
      .attr("y", d => d.display_height * that.global_scale.yscale * local_y_margin)
      .attr("height", d => d.display_height * that.global_scale.yscale * (1 - 2 * local_y_margin))
      .attr("width", row_name_width * 0.65)
      .attr("opacity", d => d.selected ? 1 : 0)
      .append("xhtml:div")
    foreign_objects.append("div")
      .classed("row-sliders", true)
      .attr("id", (d) => `row-slider-${d.i}`)
      .style("height", d => `${d.display_height * that.global_scale.yscale * (1-2*local_y_margin)}px`)
      .style("padding-left", d => `5px`)
    rows.select('.foreign').transition()
      .duration(Animation.update)
      .attr("y", d => d.display_height * that.global_scale.yscale * local_y_margin)
      .attr("height", d => d.display_height * that.global_scale.yscale * (1 - 2 * local_y_margin))
      .attr("width", row_name_width * 0.7)
      .attr("opacity", d => d.selected ? 1 : 0)
    rows.select('.row-sliders').transition()
      .duration(Animation.update)
      .style("height", d => `${d.display_height * that.global_scale.yscale * (1-2*local_y_margin)}px`)
      .style("padding-left", d => `5px`)
      
    rows.selectAll(".foreign").attr("opacity", d => d.selected ? 1 : 0)
    rows_enter
      .append("text")
      .classed("row-id-1", true)
      .text((d, i) => LearnerCluster.cluster2name[d.cluster])
      .attr("text-anchor", "start")
      .attr("dy", "0.35em")
      .attr("x", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? row_name_width * 0.25 : row_name_width * 0.3)
      .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2)
      .attr("font-size", font_size)
      .style("opacity", 0)
      .transition()
      .delay(that.first_time ? 0 : Animation.enterDelay)
      .duration(that.first_time ? 0 : Animation.update)
      .style("opacity", 1);
    rows
      .select(".row-id-1")
      .text((d, i) => LearnerCluster.cluster2name[d.cluster])
      .attr("d", (d,i) => d.show ? UNHIDE : HIDE)
      .transition()
      .duration(Animation.update)
      .attr("x", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? row_name_width * 0.25 : row_name_width * 0.3)
      .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2)
      
    if (document.querySelectorAll('.row-sliders .noUi-base').length == 0) {
        [].slice.call(document.getElementsByClassName('row-sliders')).forEach(function (slider, index) {
          noUiSlider.create(slider, {
              start: Model.ensemble.clfs_weight[that.rows[index].learner],
              connect: [true, false],
              orientation: "horizontal",
              range: {
                  'min': 0,
                  'max': 2
              },
          });
          slider.setAttribute('disabled', true);
          slider.noUiSlider.set(1);
          that.all_sliders[that.rows[index].learner] = slider;
      });
    }

    const cols = svg.select("g#cols").selectAll("g.col").data(that.cols, d=>d.label);
    cols.exit().transition().duration(Animation.exit).remove();
    const cols_enter = cols
      .enter()
      .append("g")
      .classed("col", true)
      .attr("id", (d) => `col-${d.label}`)
      .on("mouseover", (d) => {
        that._draw_highlight_strip_col(d.cluster);
      })
      .on("mouseout", (d) => {
        that.clean_highlight_strip();
        tooltip.transition().duration(500).style("opacity", 0);
        tooltip.html(null);
      })
      .on("click", that._background_cell_on_click)
      .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${0})`);
    cols
      .transition()
      .duration(Animation.update)
      .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${0})`);

    cols_enter
      .append("rect")
      .classed("col-bar", true)
      .attr("id", (d) => `col-bar-${d.label}`)

      .on("click", that.label_click)
      .attr("fill", "#dedef0")
      .attr("stroke", (d) => "#a3a8c5")
      .attr("stroke-width", 0)
      .attr("height", (d) => 5 + (col_height-5) * d.col_val * d.col_val_coef * 1.2)
      .attr("width", (d) => d.display_width * that.global_scale.xscale * (1 - 2 * col_margin))
      .attr("x", (d) => d.display_width * that.global_scale.xscale * col_margin)
      .attr("y", (d) => col_id_offset)
      .style("opacity", 0)
      .transition()
      .delay(firsttime ? 0 : Animation.enterDelay)
      .duration(firsttime ? 0 : Animation.enter)
      .style("opacity", 1);
    cols
      .select("rect.col-bar")
      .transition()
      .duration(Animation.update)
      .attr("width", (d) => d.display_width * that.global_scale.xscale * (1 - 2 * col_margin))
      .attr("x", (d) => d.display_width * that.global_scale.xscale * col_margin)
      .attr("height", (d) => 5 + (col_height-5) * d.col_val * d.col_val_coef * 1.2)

    cols_enter
      .append("text")
      .classed("col-val", true)
      .text((d) => Number(d.col_val).toFixed(d.i == -1 ? 2 : 3).substr(1))
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("x", (d) => (d.display_width * that.global_scale.xscale) / 2)
      .attr("y", col_id_offset + col_val_offset)
      .attr("font-size", small_num_font_size)
      .style("opacity", 0)
      .transition()
      .delay(firsttime ? 0 : Animation.enterDelay)
      .duration(firsttime ? 0 : Animation.enter)
      .style("opacity", 1);
    cols
      .select("text.col-val")
      .transition()
      .duration(Animation.update)
      .text((d) => Number(d.col_val).toFixed(d.i == -1 ? 2 : 3).substr(1))
      .attr("x", (d) => (d.display_width * that.global_scale.xscale) / 2)
      .style("opacity", d => d.selected ? 1 : 0);

    cols_enter
      .append("text")
      .classed("col-id", true)
      .each(function(d) {
        draw_text_multiline(d3.select(this), LabelCluster.name[d.label], actual_label_font_size, d.display_width * that.global_scale.xscale, label_font_size * 4)
      })
      .attr("transform", d => `translate(${d.display_width * that.global_scale.xscale/2},2)`)
      .attr("fill", (d, i) => i == 0 ? "black" : LabelCluster.get_font_color(d.cluster))
      .style("opacity", 0)
      .transition()
      .delay(firsttime ? 0 : Animation.enterDelay)
      .duration(firsttime ? 0 : Animation.enter)
      .style("opacity", 1)
    cols
      .select("text.col-id")
      .transition()
      .duration(Animation.update)
      .each(function(d) {
        draw_text_multiline(d3.select(this), LabelCluster.name[d.label], actual_label_font_size, d.display_width * that.global_scale.xscale, label_font_size * 4)
      })
      .style("opacity", d => d.selected ? 1 : 0)
      .attr("transform", d => `translate(${d.display_width * that.global_scale.xscale/2},2)`);

  cols_enter
    .append("path")
    .classed("col-hide-glyph", true)
    .on("click", that.cluster_hide_click)
    .attr("d", (d,i) => d.selected ? UNHIDE : HIDE)
    .attr("transform", d => d.selected ? `translate(${(d.display_width * that.global_scale.xscale) / 2-5.25}, ${-30}) scale(0.012,0.012)`
    : `translate(${(d.display_width * that.global_scale.xscale) / 2-2.2}, ${-30}) scale(0.005,0.012)`)
    .attr("fill", d => LabelCluster.dark_color[d.label])
    .style("opacity", 0)
    .transition()
    .delay(firsttime ? 0 : Animation.enterDelay)
    .duration(firsttime ? 0 : Animation.enter)
    .style("opacity", d => d.label >= 0  ? 1 : 0);
  cols
    .select(".col-hide-glyph")
    .on("click", that.cluster_hide_click)
    .attr("d", (d,i) => d.selected ? UNHIDE : HIDE)
    .transition()
    .duration(Animation.update)
    .attr("fill", d => LabelCluster.dark_color[d.label])
    .attr("transform", d => d.selected ? `translate(${(d.display_width * that.global_scale.xscale) / 2-5.25}, ${-30}) scale(0.012,0.012)`
    : `translate(${(d.display_width * that.global_scale.xscale) / 2-2.2}, ${-30}) scale(0.005,0.012)`)

    const first_cols = svg.select("g#matrix").selectAll("g.cell-overall").data(that.cells_overall, d => d.id);
    first_cols.exit().remove();
    first_cols
      .enter()
      .append("g")
      .classed("cell-overall", true)
      .attr("id", (d) => `cell-overall-${d.id}`)
      .on("mouseover", that._mouseover)
      .on("mouseout", that._mouseout)
      .attr("transform", (d) => `translate(${first_col_offset},${d.y * that.global_scale.yscale})`);
    first_cols
      .transition()
      .duration(Animation.update)
      .attr("transform", (d) => `translate(${first_col_offset},${d.y * that.global_scale.yscale})`);
    d3.selectAll("g.cell-overall").each(that.fill_cell_overall);
  
  };

  that.render_background = function () {
    const staticCellSlc = svg.select("g#matrix").selectAll("g.cell").data(that.cells, d=>d.id);
    staticCellSlc
      .enter()
      .append("g")
      .classed("cell", true)
      .attr("id", (d) => `cell-${d.id}`)
      .on("mouseover", that._mouseover)
      .on("mouseout", that._mouseout)
      .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${d.y * that.global_scale.yscale})`)
      .append("rect")
      .classed("background", true)
      .attr("id", (d) => `background-${d.id}`)
      .attr("width", (d) => d.display_width * that.global_scale.xscale)
      .attr("height", (d) => d.display_height * that.global_scale.yscale)
      .attr("fill-opacity", 0);

    staticCellSlc.exit().transition().duration(Animation.exit).remove();
    staticCellSlc
      .transition()
      .duration(Animation.update)
      .attr("transform", (d) => `translate(${d.x * that.global_scale.xscale},${d.y * that.global_scale.yscale})`);
    
    staticCellSlc
      .select("rect.background")
      .transition()
      .duration(Animation.update)
      .attr("width", (d) => d.display_width * that.global_scale.xscale)
      .attr("height", (d) => d.display_height * that.global_scale.yscale);
      return;
  };

  that.generate_detail = function () {
    d3.selectAll("g.cell").each(that.fill_cell);
  };

  that.fill_cell = function (cell) {
    const g = d3.select(`g#cell-${cell.id}`);
    that._fill_dot_chart_detail(cell, g);
    if (cell.barchart) {
      that.fill_barchart(cell, g);
    } else {
      g.select('.barchart')
      .transition().duration(Animation.update)
      .attr('transform',  `translate(${cell.layout.width * col_margin}, ${cell.layout.height * row_margin})`)
      .remove();
      g.selectAll(".learner-bar").remove();
      g.selectAll(".ensemble-bar").remove();
      g.selectAll(".base-bar").remove();
      g.selectAll(".base-bar-2").remove();
      g.selectAll(".background-bar")
      .transition()
      .duration(Animation.update)
      .attr("x", (d) =>  d.x = cell.layout.width * (1-2*col_margin) * d.origin_data.loc)
      .attr("y", (d) => d.y = 0)
      .attr("width", (d) => d.end_width = cell.layout.width * (1-2*col_margin) * d.origin_data.n_width)
      .attr("height", (d) => d.height = cell.layout.height * (1-2*row_margin))
      g.selectAll("g.basic-val").transition().delay(Animation.update).style("display", "block");
    }
  };

  that.fill_cell_overall = function (d) {
    const g = d3.select(`g#cell-overall-${d.id}`);
    that._fill_dot_chart_all(d, g);
  };

  that.fill_barchart = function(cell, g) {
    const plot_g = g.select('.barchart').node() ? g.select('.barchart') : g.append('g').attr('class', 'barchart');
    plot_g.on("dblclick", () => {
      cell.barchart = false; 
      that.current_select_box = null;
      cell.barchart = false;
      that.rows[cell.i].display_height = that.rows[cell.i].old_display_height;
      that.cols[cell.j+1].display_width = that.cols[cell.j+1].old_display_width;
      that.calculate_layout(false);
      that.adjust_row_loc();
      that.update_cols(cell.j);
    })
    g.selectAll("g.basic-val").style("display", "none");
    plot_g.style("pointer-events", "none").style("display", "block");
    const barchart_info = LabelCluster.generate_barchart_info(cell.i, cell.j);
    //const data = barchart_info[0]
    const data = barchart_info[0].concat(barchart_info[1])
    const thres = [0.25,0.5,0.75];
    const get_count = ((arr, thres) => {
      let cnt = new Array(thres.length+1).fill(0);
      for (let val of arr) {
        let idx = 0;
        while (idx < thres.length && val > thres[idx]) ++idx;
        cnt[idx]++;
      }
      return cnt;
    })
    const ensemble = get_count(data.map(d => d[0]), thres);
    const learner = get_count(data.map(d => d[1]), thres);
    console.log(learner, ensemble)
    const old_layout = cell.old_layout;
    const new_layout = cell.layout;
    old_layout.xmargin = old_layout.width * col_margin, old_layout.ymargin = old_layout.height * row_margin;
    new_layout.xmargin = new_layout.width * col_margin, new_layout.ymargin = new_layout.height * row_margin;
    old_layout.plot_width = old_layout.width - old_layout.xmargin * 2, old_layout.plot_height = (old_layout.height - old_layout.ymargin * 2);
    new_layout.plot_width = new_layout.width - new_layout.xmargin * 2, new_layout.plot_height = (new_layout.height - new_layout.ymargin * 2);

    plot_g
      .attr('transform',  `translate(${old_layout.xmargin}, ${old_layout.ymargin})`)
      .style("pointer-events", "none")
      .transition().duration(Animation.update)
      .attr('transform',  `translate(${new_layout.xmargin}, ${new_layout.ymargin})`)
      .style("pointer-events", "auto");
      const n_width = 0.9;
      const origin_rect_data = g.selectAll("g.basic-val").data();
      //const coef = 0.5
      //const coef = Math.sqrt(origin_rect_data[0].n_width / (origin_rect_data[0].n_width + origin_rect_data[2].n_width))
      const coef = 1 / (1+1/Math.sqrt((origin_rect_data[0].n_width+0.001) / (origin_rect_data[2].n_width+0.001)))
      const rect_data = [{'n_width':(1-n_width) * coef}, {'n_width':n_width}, {'n_width':(1-n_width) * (1-coef)}];
      let loc = 0;
      const color = origin_rect_data[1].color;
      for (let k = 0; k < 3; ++k) {
        rect_data[k].color = origin_rect_data[k].color;
        rect_data[k].stroke = origin_rect_data[k].stroke;
        rect_data[k].loc = loc;
        rect_data[k].k = k;
        rect_data[k].i = cell.i;
        rect_data[k].j = cell.j;
        rect_data[k].origin_data = origin_rect_data[k];
        loc += rect_data[k].n_width;
      }
      const cells = plot_g.selectAll("rect.background-bar").data(rect_data, d=>d.k)
      cells
        .enter()
        .append("rect")
        .classed("background-bar", true)
        .attr("fill", d => d.color)
        .attr("stroke", d => d.stroke)
        .attr("stroke-opacity", 1)
        .style("opacity", 1)
        .attr("x", (d) => d.x = old_layout.plot_width * d.origin_data.loc)
        .attr("y", (d) => d.y = 0)
        .attr("width", (d) => d.end_width = old_layout.plot_width * d.origin_data.n_width)
        .attr("height", (d) => d.height = old_layout.plot_height)
        .transition()
        .duration(Animation.update)
        .attr("x", (d) => d.x = new_layout.plot_width * d.loc)
        .attr("y", (d) => d.y = 0)
        .attr("width", (d) => d.end_width = new_layout.plot_width * d.n_width)
        .attr("height", (d) => d.height = new_layout.plot_height)


      cells
      .attr("x", (d) => d.x = old_layout.plot_width * d.loc)
      .attr("y", (d) => d.y = 0)
      .attr("width", (d) => d.end_width = old_layout.plot_width * d.n_width)
      .attr("height", (d) => d.height = old_layout.plot_height)
      .transition()
      .duration(Animation.update)
      .attr("x", (d) =>  d.x = new_layout.plot_width * (cell.barchart ? d.loc : d.origin_data.loc))
      .attr("y", (d) => d.y = 0)
      .attr("width", (d) => d.end_width = new_layout.plot_width * (cell.barchart ? d.n_width : d.origin_data.n_width))
      .attr("height", (d) => d.height = new_layout.plot_height)


    old_layout.width_step = old_layout.plot_width / (thres.length + 1.6) * n_width;
    old_layout.bar_width = old_layout.width_step * 0.3;
    old_layout.xoffset = old_layout.plot_width * (1-n_width) * coef + old_layout.width_step * -0.2;
    new_layout.width_step = new_layout.plot_width / (thres.length + 1.6) * n_width;
    new_layout.bar_width = new_layout.width_step * 0.3;
    new_layout.xoffset = new_layout.plot_width * (1-n_width) * coef + new_layout.width_step * -0.2;
    const max_y = Math.max(Math.max(...learner), Math.max(...ensemble));
    const old_y = d3.scaleLinear().domain([0, max_y]).range([0, old_layout.plot_height*0.8]);
    const new_y = d3.scaleLinear().domain([0, max_y]).range([0, new_layout.plot_height*0.8]);
    const min_height = 0;  
    const learner_bar = plot_g.selectAll(".learner-bar").data(learner);
    learner_bar.enter().append("rect").classed("learner-bar", true).attr("fill", d => d == -1 ? "#85889c" :  adjustColorOpacity(color, left_opacity)).merge(learner_bar)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1-0.02) - new_layout.bar_width).attr("y", d => new_layout.plot_height-.5 - (d==0 ? 0 : new_y(0))).attr("width", new_layout.bar_width).attr("height", d => d==0 ? 0 : new_y(0))
    .transition().delay(Animation.update).style("opacity", 1).duration(Animation.update)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1-0.02) - new_layout.bar_width).attr("y", d => new_layout.plot_height-.5 - (d==0 ? 0 : new_y(d))).attr("width", new_layout.bar_width).attr("height", d => d==0 ? min_height : new_y(d))
    learner_bar.attr("x", (d,i) => old_layout.xoffset + old_layout.width_step * (i+1-0.02) - old_layout.bar_width).attr("y", d => old_layout.plot_height-.5 - (d==0 ? 0 : old_y(d))).attr("width", old_layout.bar_width).attr("height", d => d==0 ? min_height : old_y(d))
    .transition().style("opacity", 1).duration(Animation.update)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1-0.02) - new_layout.bar_width).attr("y", d => new_layout.plot_height-.5 - (d==0 ? 0 : new_y(d))).attr("width", new_layout.bar_width).attr("height", d => d==0 ? min_height : new_y(d))
  
    const ensemble_bar = plot_g.selectAll(".ensemble-bar").data(ensemble);
    ensemble_bar.enter().append("rect").classed("ensemble-bar", true).attr("fill", d => d == -1 ? "#85889c" : adjustColorOpacity(color, right_opacity))
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1+0.02)).attr("y", d => new_layout.plot_height-.5 - (d==0 ? 0 : new_y(0))).attr("width", new_layout.bar_width).attr("height", d => d==0 ? 0 : new_y(0))
    .transition().delay(Animation.update).style("opacity", 1).duration(Animation.update)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1+0.02)).attr("y", d => new_layout.plot_height-.5 - (d==0 ? 0 : new_y(d))).attr("width", new_layout.bar_width).attr("height", d => d==0 ? min_height : new_y(d))
    ensemble_bar.attr("x", (d,i) => old_layout.xoffset + old_layout.width_step * (i+1+0.02)).attr("y", d => old_layout.plot_height-.5 - (d==0 ? 0 : old_y(d))).attr("width", old_layout.bar_width).attr("height", d => d==0 ? min_height : old_y(d))
      .transition().style("opacity", 1).duration(Animation.update)
      .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1+0.02)).attr("y", d => new_layout.plot_height-.5 - (d==0 ? 0 : new_y(d))).attr("width", new_layout.bar_width).attr("height", d => d==0 ? min_height : new_y(d))

    const base_bar = plot_g.selectAll(".base-bar").data(ensemble);
    base_bar.enter().append("rect").classed("base-bar", true).attr("fill", LabelCluster.cluster2colors[LabelCluster.origin_label_cluster[cell.label]][1]).merge(base_bar)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1-0.02) - new_layout.bar_width).attr("y", d => new_layout.plot_height-.5).attr("width", new_layout.bar_width ).attr("height", d => 0)
    .transition().delay(Animation.update).style("opacity", 1).duration(Animation.update)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1-0.02) - new_layout.bar_width).attr("y", d => new_layout.plot_height-.5).attr("width", new_layout.bar_width ).attr("height", d => 1)
    base_bar.attr("x", (d,i) => old_layout.xoffset + old_layout.width_step * (i+1+0.02) - old_layout.bar_width).attr("y", d => old_layout.plot_height-.5).attr("width", old_layout.bar_width + old_layout.width_step * 0.04).attr("height", 1)
      .transition().style("opacity", 1).duration(Animation.update)
      .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1-0.02) - new_layout.bar_width).attr("y", d => new_layout.plot_height-.5).attr("width", new_layout.bar_width ).attr("height", d => 1)
    const base_bar2 = plot_g.selectAll(".base-bar-2").data(ensemble);
    base_bar2.enter().append("rect").classed("base-bar-2", true).attr("fill", LabelCluster.cluster2colors[LabelCluster.origin_label_cluster[cell.label]][1]).merge(base_bar2)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1+0.02) ).attr("y", d => new_layout.plot_height-.5).attr("width", new_layout.bar_width ).attr("height", d => 0)
    .transition().delay(Animation.update).style("opacity", 1).duration(Animation.update)
    .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1+0.02)).attr("y", d => new_layout.plot_height-.5).attr("width", new_layout.bar_width ).attr("height", d => 1)
    base_bar2.attr("x", (d,i) => old_layout.xoffset + old_layout.width_step * (i+1+0.02) ).attr("y", d => old_layout.plot_height-.5).attr("width", old_layout.bar_width + old_layout.width_step * 0.04).attr("height", 1)
      .transition().style("opacity", 1).duration(Animation.update)
      .attr("x", (d,i) => new_layout.xoffset + new_layout.width_step * (i+1+0.02) ).attr("y", d => new_layout.plot_height-.5).attr("width", new_layout.bar_width ).attr("height", d => 1)
}

  that._update_layout = function (d) {
    d.layout = {
      width: d.layout_width,
      height: d.layout_height,
      min_size: d.min_size,
      r: d.r,
      square_size: d.square_size,
    };
  };
  that._fill_dot_chart_all = function (cell, g) {
    const dot = g.selectAll("rect.basic-val-all").data([cell], d=>d.id);
    const old_layout = cell.layout;
    const margin = 0.15;
    that._update_layout(cell);
    dot
      .enter()
      .append("rect")
      .classed("basic-val-all", true)
      .attr("x", -cell.display_width * that.global_scale.xscale / 2 - old_layout.r * (1 - 2 * margin) / 2)
      .attr("y", cell.display_height * that.global_scale.yscale / 2 - old_layout.r * (1 - 2 * margin) / 2)
      .attr("rx", old_layout.r )
      .attr("ry", old_layout.r )
      .attr("width", old_layout.r * (1 - 2 * margin) )
      .attr("height", old_layout.r * (1 - 2 * margin) )
      .attr("fill", (d) => gray_scale(d.val / DataLoader.state.N))
      .style("opacity", 0)
      .on("mouseover", (d) => {
        clearTimeout(that.scatter_timer)
        that.scatter_timer = setTimeout(() =>
          DataLoader.highlight(d.idx)
        , 200)
      })
      .on("mouseout", (d) => {
        tooltip.transition().duration(500).style("opacity", 0);
        tooltip.html(null);
        clearTimeout(that.scatter_timer)
        that.scatter_timer = setTimeout(() =>
          DataLoader.unhighlight()
        , 200)
      })
      .on("click", function (d) {
        if (that.current_select_box !== null) {
          if (d.focus) {
            that.current_select_box = null;
            d.focus = false;
            d3.select(this).attr("stroke-width", (d) => 1);
            DataLoader.unselect("matrix-cell");
            that.highlight();
          } else {
            [other_d, other_g] = that.current_select_box;
            other_d.focus = false;
            other_g.attr("stroke-width", 1);
            that.current_select_box = [d, d3.select(this)];
            d.focus = true;
            DataLoader.select(d.idx, "matrix-cell");
          }
        } else {
          that.current_select_box = [d, d3.select(this)];
          d.focus = true;
          DataLoader.select(d.idx, "matrix-cell");
        }
      })
      .merge(dot)
      .transition()
      .duration(that.firsttime ? 0 : Animation.update)
      .style("opacity", 1)
      .attr("x", -cell.display_width * that.global_scale.xscale / 2 - old_layout.r * (1 - 2 * margin) / 2)
      .attr("y", cell.display_height * that.global_scale.yscale / 2 - old_layout.r * (1 - 2 * margin) / 2)
      .attr("rx", cell.layout.r)
      .attr("ry", cell.layout.r)
      .attr("width", cell.layout.r * (1 - 2 * margin))
      .attr("height", cell.layout.r * (1 - 2 * margin))
  };

  that.highlight = function (idx) {
    that.highlight_idx = idx ? idx.slice() : null;
    const cells = d3.selectAll("g.basic-val")
    if (!idx) {
      cells.each((d) => { d.cnt = 0; d.percentage=0;});
      cells
        .selectAll("rect.base")
        .attr("fill-opacity", (d) => (d.k % 3 === 1 ? 1 : d.k % 3 === 0 ? left_opacity : right_opacity))
        .attr("stroke-opacity", 1)
        .attr("fill", (d) => d.color)
        .attr("stroke", (d) => d.stroke)
        .attr("width", (d) => d.end_width)
      cells.selectAll("rect.extend")
        .attr("width", d => d.end_width * d.percentage)
        .attr("stroke", d => d.stroke)
        .attr("stroke-width", 0.3)
        .attr("fill", d => d.color)
    } else {
      cells.each(function (d) {
          let cnt = 0;
          for (let i of idx) if (d.idx.includes(i)) cnt += 1;
          d.cnt = cnt;
          if (d.i != 0 && d.i != 9 && d.j == 10 && d.k==0) d.cnt = Math.sqrt(d.cnt);
          d.percentage = Math.sqrt(((d.cnt + (d.cnt > 0)) / d.idx.length));
        })
      cells
        .selectAll("rect.base")
        .attr("stroke", "gray")
        .attr("fill", "gray")
        .attr("fill-opacity", 0.05)
        .attr("stroke-opacity", 0.3);
      cells.selectAll("rect.extend")
        .attr("width", d => d.end_width * d.percentage)
        .attr("stroke", d => d.stroke)
        .attr("stroke-width", 0.3)
        .attr("fill", d => d.color)
    }
  };

  that._fill_dot_chart_detail = function (cell, g) {
    let dot = null, rect_data = null;
    if (g.selectAll("g.basic-val").data().length == 0) {
    rect_data = [{ idx: cell.info.clf1_idx }, { idx: cell.info.both_idx }, { idx: cell.info.clf2_idx }];
    const sum = cell.sum;
    const epsilon = cell.sum * 0.1;
    const no_zero_epsilion = rect_data.filter((x) => x.idx.length > 0).length
    const n_widthes = rect_data.map((x) =>
      (x.idx.length + epsilon / 3 + (x.idx.length > 0)) / 
      (sum + epsilon + no_zero_epsilion)
    );
    let loc = 0;
    const color = LabelCluster.dark_color[cell.label]
    for (let k = 0; k < 3; ++k) {
      rect_data[k].color = adjustColorOpacity(color, k == 1 ? 1 : k == 0 ? left_opacity : right_opacity);
      rect_data[k].stroke = color;
      rect_data[k].loc = loc;
      rect_data[k].n_width = n_widthes[k] * cell.inner_width;
      rect_data[k].end_width = cell.inner_width * cell.layout.width * (1 - 2 * col_margin) * n_widthes[k]
      rect_data[k].k = k;
      rect_data[k].i = cell.i;
      rect_data[k].j = cell.j;
      loc += rect_data[k].n_width;
    }
    dot = g.selectAll("g.basic-val").data(rect_data)
  } else {
    dot = g.selectAll("g.basic-val")
    const color = LabelCluster.dark_color[cell.label]
    rect_data = dot.data();
    dot.each(d => {
      d.color = adjustColorOpacity(color, d.k == 1 ? 1 : d.k == 0 ? left_opacity : right_opacity);
      d.stroke = color;
      d.i = cell.i;
      d.j = cell.j;
    })
  }
    const old_layout = cell.layout;
    cell.old_layout = old_layout;
    that._update_layout(cell);
    const cells = dot
      .enter()
      .append("g")
      .classed("basic-val", true)
    cells
    .on("mouseover", function (d) {
      d3.select(this).selectAll("rect").attr("stroke-width", 2);
        clearTimeout(that.scatter_timer)
        that.scatter_timer = setTimeout(() =>
          DataLoader.highlight(d.idx)
        , 200)
    })
    .on("mouseout", function (d) {
      d3.select(this).selectAll("rect").attr("stroke-width", (d) => (d.focus ? 2 : 1));
      tooltip.transition().duration(500).style("opacity", 0);
      tooltip.html(null);
      clearTimeout(that.scatter_timer)
      that.scatter_timer = setTimeout(() =>
        DataLoader.unhighlight()
      , 200)
    })
    .on("dblclick", function (d) {
      clearTimeout(that.cell_click_timeout);
      that.cell_click_timeout = -1;
      const cell = Matrix.cells.find(c => c.i == d.i && c.j == d.j)
      if (that.current_barchart !== null) {
        if (cell.barchart) {
          that.current_barchart = null;
          cell.barchart = false;
          that.rows[cell.i].display_height = that.rows[cell.i].old_display_height;
          that.cols[cell.j+1].display_width = that.cols[cell.j+1].selected ? that.cols[cell.j+1].old_display_width : min_width;
        } else {
          other_cell = that.current_barchart;
          other_cell.barchart = false;
          that.rows[other_cell.i].display_height = that.rows[other_cell.i].old_display_height;
          that.cols[other_cell.j+1].display_width = that.cols[other_cell.j+1].selected ? that.cols[other_cell.j+1].old_display_width : min_width;
          that.current_barchart = cell;
          cell.barchart = true;
          that.rows[cell.i].old_display_height = that.rows[cell.i].display_height;
          that.cols[cell.j+1].old_display_width = that.cols[cell.j+1].display_width;
          that.rows[cell.i].display_height = 2 * that.rows[cell.i].old_display_height;
          that.cols[cell.j+1].display_width = 2 * that.cols[cell.j+1].old_display_width;
        }
      } else {
        that.current_barchart = cell;
        cell.barchart = true;
        that.rows[cell.i].old_display_height = that.rows[cell.i].display_height;
        that.cols[cell.j+1].old_display_width = that.cols[cell.j+1].display_width;
        that.rows[cell.i].display_height = 2 * that.rows[cell.i].old_display_height;
        that.cols[cell.j+1].display_width = 2 * that.cols[cell.j+1].old_display_width;
      }
      that.calculate_layout(false);
      that.adjust_row_loc();
      that.update_cols(cell.j);
    })
    .on("click", function (d) {
      clearTimeout(that.cell_click_timeout)
      that.cell_click_timeout = setTimeout(() => {
        if (that.current_select_box !== null) {
          if (d.focus) {
            that.current_select_box = null;
            d.focus = false;
            d3.select(this).selectAll("rect").attr("stroke-width", (d) => 1);
            DataLoader.unselect("matrix-cell");
            that.highlight();
          } else {
            [other_d, other_g] = that.current_select_box;
            other_d.focus = false;
            other_g.attr("stroke-width", 1);
            that.current_select_box = [d, d3.select(this).selectAll("rect")];
            d.focus = true;
            DataLoader.select(d.idx, "matrix-cell");
          }
        } else {
          that.current_select_box = [d, d3.select(this).selectAll("rect")];
          d.focus = true;
          DataLoader.select(d.idx, "matrix-cell");
        }
        that.calculate_layout(false);
        that.adjust_row_loc();
        that.update_cols(d.j);
      }, DOUBLE_CLICK_TIME);
    })
    

    cells
      .append("rect")
      .classed("base", true)
      .attr("x", (d) => d.x = old_layout.width * col_margin + old_layout.width * (1 - 2 * col_margin) * d.loc)
      .attr("y", (d) => d.y = old_layout.height * row_margin)
      .attr("width", (d) => d.end_width = old_layout.width * (1 - 2 * col_margin) * d.n_width)
      .attr("height", d => d.height = old_layout.height * (1 - 2 * row_margin))
      .attr("fill", d => d.color)
      .attr("stroke", d => d.stroke)
      .attr("stroke-opacity", 1)
      .attr("stroke-width", (d) => (d.focus ? 2 : 1))
      .style("opacity", 0)
      .transition()
      .delay(that.first_time ? 0 : Animation.enterDelay)
      .duration(that.first_time  ? 0 : Animation.enter)
      .style("opacity", 1);

    cells
      .append("rect")
      .classed("extend", true)
      .style("pointer-events", "none")
      .attr("x", (d) => old_layout.width * col_margin + old_layout.width * (1 - 2 * col_margin) * d.loc)
      .attr("y", (d) => old_layout.height * (row_margin))
      .attr("width", (d) => 0)
      .attr("height", d => d.height)

    dot
      .select("rect.base")
      .transition()
      .duration(Animation.update)
      .attr("x", (d) => d.x = cell.layout.width * col_margin + cell.layout.width * (1 - 2 * col_margin) * d.loc)
      .attr("y", (d) => d.y = cell.layout.height * (row_margin))
      .attr("width", (d) => d.end_width = cell.layout.width * (1 - 2 * col_margin) * d.n_width)
      .attr("height", (d) => d.height = cell.layout.height * (1 - 2 * row_margin))
      .attr("fill", d => that.highlight_idx ? "gray" : d.color)
      .attr("stroke", d => that.highlight_idx ? "gray" : d.stroke);

    dot
      .select("rect.extend")
      .transition()
      .duration(Animation.update)
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("width", (d) => d.percentage ? d.end_width * d.percentage : 0)
      .attr("height", d => d.height)
      .attr("fill", d => d.color)
      .attr("stroke", d => d.stroke);
  };
  that._Manhattan_dist = function (x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  };

  that._dist2coef = function (dist) {
    return dist === 0 ? 5 : 1;
  };

  that._update_single_width = function (d) {
    let min_dist = 9999;
    for (let focus of that.focus_cells) {
      min_dist = Math.min(min_dist, that._Manhattan_dist(focus[0], focus[1], d.i, d.j));
    }
    let coef = that._dist2coef(min_dist);
    d.height = basic_height * coef;
    d.width = basic_width * coef;
  };

  that._update_width = function () {
    for (let j = 0; j < that.K; ++j) {
      const width = basic_width * (that.focus_cells.includes(j) ? 2.5 : 1);
      for (let i = 0; i < that.N; ++i) {
        let d = that.cells[i * that.K + j];
        d.width = width;
      }
    }
  };

  that._background_cell_on_click = function (d) {};

  that._mouseover = function (d) {
    if (that.animation_flag) return;
    that._draw_highlight_strip_row();
    that._draw_highlight_strip_col(d.cluster);
  };

  that._mouseout = function (d) {
    if (that.animation_flag) return;
    that.clean_highlight_strip();
  };

  that.get_selected_baselearners = function () {
    return that.rows.filter((x) => x.selected).map((x) => x.learner);
  };

  that.toggle_row_mode = function() {
    that.row_mode = that.row_mode === 'compact' ? 'cluster' : 'compact';
    d3.select('#row-mode')
    .attr("fill", that.row_mode === 'cluster' ? CHECK_FILL[2] : CHECK_FILL[0])
    .attr("stroke", that.row_mode === 'cluster' ? CHECK_STROKE[2] : CHECK_STROKE[0])
    d3.select('#cluster-check').attr("fill-opacity", that.row_mode === 'cluster' ? 1 : 0);
    let tmp = [].concat(that.rows).concat(that.cells_overall).concat(that.cells);
    tmp.forEach(d => d.old_location = d.y * that.global_scale.yscale)
    that.calculate_layout(false);
    tmp.forEach(d => d.xoffset = d.y * that.global_scale.yscale > d.old_location + 20 ? 20 :  
                                        d.y * that.global_scale.yscale < d.old_location - 20 ? 0 : 0);
    that.update_rows()
    tmp.forEach(d => d.xoffset = 0);
  }

  that.adjust_row_loc = function() {
    const cbox_size = 10//that.height_each_row / 2;
    const rows = svg
    rows.selectAll(".row")
    .transition()
    .duration(Animation.update)
    .attr("transform", (d) => `translate(${0},${d.y * that.global_scale.yscale})`);
    
    rows
      .selectAll("rect.row-bar-background")
      .transition()
      .duration(Animation.update)
      .attr("height", (d) => d.display_height * that.global_scale.yscale);

    rows
      .selectAll(".row-cbox")
      .transition()
      .duration(Animation.update)
      .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2 - cbox_size / 2)
      .style("opacity", d => LearnerCluster.get_cluster_type(d.cluster) == 2 || !d.show ? 0 :1)
    rows
    .selectAll(".row-cbox-glyph")
    .transition()
    .duration(Animation.update)
    .attr("transform", d => `translate(${cbox_size/2+cbox_xoffset+cbox_size/10+2}, ${(d.display_height * that.global_scale.yscale) / 2 - cbox_size*0.8 / 2}) scale(${cbox_size/1750},${cbox_size/1350})`)
    .style("opacity", d => LearnerCluster.get_cluster_type(d.cluster) == 2 || !d.show ? 0 :1)

    rows
      .selectAll(".weight-btn")
      .transition()
      .duration(Animation.update)
      .attr('transform', d => `translate(${row_name_width*0.9},${(d.display_height * that.global_scale.yscale) / 2 - row_name_width*0.05})`)
      
      .style("display", d => LearnerCluster.get_cluster_type(d.cluster) == 2 || !d.show  ? "none" : "block")
      .style("opacity", (d) => d.selected_status === 0 ? 0 : 1)
      .style("pointer-events", (d) => d.selected_status === 0 ? "none" : "default")
    rows.selectAll(".up-btn").transition().duration(Animation.update).attr('transform', (d,i) => `translate(0,2) `)
    rows.selectAll(".down-btn").transition().duration(Animation.update).attr('transform', (d,i) => `translate(0,10)  `)
    rows
      .selectAll(".row-hide-glyph")
      .attr("d", (d,i) => d.show ? UNHIDE : HIDE)
      .attr("fill", "#242939")//"#dbdbef")
      .transition()
      .duration(Animation.update)
      .attr("transform", d => `translate(${0}, ${(d.display_height * that.global_scale.yscale - (d.show ? 11 : 11)) / 2}) scale(0.012,${d.show ? 0.012 : 0.012})`);
     const local_y_margin = 0.15;
      rows
    .selectAll(".foreign")
    .transition()
    .duration(Animation.update)
    //.attr("height", d => d.display_height * that.global_scale.yscale)
    .attr("y", d => d.display_height * that.global_scale.yscale * local_y_margin)
    .attr("height", d => d.display_height * that.global_scale.yscale * (1 - 2 * local_y_margin))
    .style("opacity",d => d.selected ? 1 : 0)
    const local_row_margin = 0.15;
    rows
    .selectAll(".foreign .row-sliders")
    .transition()
    .duration(Animation.update)
    .style("height", d => `${d.display_height * that.global_scale.yscale * (1-2*local_row_margin)}px`)
    //  .style("margin-top", d => `${d.display_height * that.global_scale.yscale * local_row_margin}px`)
    //  .style("margin-bottom", d => `${d.display_height * that.global_scale.yscale * local_row_margin}px`)
    rows.selectAll(".row-id-1")
    .text((d, i) => LearnerCluster.cluster2name[d.cluster])
    .transition()
    .duration(Animation.update)
    .attr("x", d => LearnerCluster.get_cluster_type(d.cluster) == 2 ? row_name_width * 0.25 : row_name_width * 0.3)
    .attr("y", (d) => (d.display_height * that.global_scale.yscale) / 2)
    .style("opacity",d => d.show ? 1 : 0)
      rows.selectAll(".cell-overall").transition()
      .duration(Animation.update).attr("transform", (d) => `translate(${first_col_offset},${d.y * that.global_scale.yscale}) scale(${1},${that.rows[d.i].show ? 1 : 0.1})`);
      d3.selectAll("g.cell-overall").each(that.fill_cell_overall);
      that.update_cells();
      that.render_label_bg();
      that.render_learner_bg();
    }


    that.render_learner_bg = function() {
      let background_data = [];
      for (let i = LearnerCluster.N - 1; i != -1; --i) {
        let cluster = LearnerCluster.learner2cluster[i]
        background_data.push({
          cluster: cluster,
          learner: i,
          idx: LearnerCluster.get_cluster_from_learner(i)[1],
          origin_cluster: LearnerCluster.origin_learner2cluster[i],
          y: that.rows[cluster].y * that.global_scale.yscale,
          height: that.rows[cluster].display_height * that.global_scale.yscale,
          show: that.rows[cluster].show,
        })
      }
      const y_margin = 0.15
      const idx_offset = 1;
      const LEFT = 18;
      
      const LIGHT = "#ededf3";
      const DARK =  "#dbdbef";
      const DARK2 = "#f6f6fb"
      const DARKEST = "#666666"
      const background = d3.select("g#rows").selectAll(".learner-bg").data(background_data, d=>d.learner);
      background.enter().append("rect")
        .classed("learner-bg", true)
        .on("mouseover", function(d) {
        })
        .on("mouseout", d => {
        })
        .attr("fill", DARK2)
        .attr("stroke", DARKEST)
        .attr("stroke-width", 0.5)
        .attr("height", d => d.height * (1-2*y_margin))
        .attr("width", (d) => 115)
        .attr("x", (d) => LEFT+2 + Math.ceil(d.idx/1.5) * idx_offset)
        .attr("y", (d) => d.y - Math.ceil(d.idx/1.5) * idx_offset + d.height * y_margin)
        .attr("rx", 2)
        .attr("rt", 2)
        .style("opacity", d => d.show || d.idx == 0 ? 1 : 0);
      
      background
        .transition()
        .duration(Animation.update)
        .attr("height", d => d.height * (1-2*y_margin))
        .attr("x", (d) => LEFT+2 + Math.ceil(d.idx/1.5) * idx_offset)
        .attr("y", (d) => d.y - Math.ceil(d.idx/1.5) * idx_offset + d.height * y_margin)
        .style("opacity", d => d.show || d.idx == 0 ? 1 : 0);
      

      let glyph_data = background_data.filter(d => LearnerCluster.get_cluster_type(d.cluster) === 1).sort((x,y) => y.cluster - x.cluster);
      const glyph = svg.select("g#rows").selectAll(".cluster-glyph").data(glyph_data, d => d.learner);
      glyph.exit().remove();
      glyph.enter().append("circle").classed("cluster-glyph", true)
      .on("click", d => {
        let type = LearnerCluster.get_cluster_type(d.cluster);
        if (type === 1) {
          LearnerCluster.shrink_learner(d.learner);
        }
        if (type === 2) {
          LearnerCluster.expand_learner(d.learner);
        }
      })
      .attr("fill", DARKEST)
      .attr("r", 4)
      .attr("cx", (d) => LEFT)
      .attr("cy", (d) => d.y + d.height / 2)
      .style("opacity", 0)
      .transition()
      .delay(Animation.enterDelay)
      .duration(Animation.enter)
      .style("opacity", 1);
      glyph
      .transition()
      .duration(Animation.update)
      .attr("cy", (d) => d.y + d.height / 2)

      let line_data = []
      for (let i = 1; i < glyph_data.length; ++i) {
        let lhs = glyph_data[i-1], rhs = glyph_data[i];
        if (lhs.origin_cluster !== rhs.origin_cluster) continue;
        line_data.push({
          r: lhs.y + lhs.height / 2,
          l: rhs.y + rhs.height / 2,
          color: DARKEST,
          id: `${lhs.learner}-${rhs.learner}`
        })
      }
      const line = svg.select("g#rows").selectAll(".line-glyph").data(line_data, d => d.id);
      line.exit().remove();
      line.enter().append("rect").classed("line-glyph", true)
      .on("click", d => {
        let type = LearnerCluster.get_cluster_type(d.cluster);
        if (type === 1) {
          LearnerCluster.shrink_learner(d.learner);
        }
        if (type === 2) {
          LearnerCluster.expand_learner(d.learner);
        }
      })
      .attr("fill", DARKEST)
      .attr("x", (d) => LEFT-1)
      .attr("width", (d) => 2)
      .attr("height", d => d.r - d.l)
      .attr("y", d => d.l)
      .style("opacity", 0)
      .transition()
      .delay(that.firsttime ? 0 : Animation.enterDelay)
      .duration(that.firsttime ? 0 : Animation.enter)
      .style("opacity", 1)

      line
      .transition()
      .duration(Animation.update)
      .attr("fill", d => d.color)
      .attr("height", d => d.r - d.l)
      .attr("y", d => d.l)
    }

    that.increase_weight = function(d) {
      d3.select(`#up-btn-${d.cluster}`).attr('fill', '#5d6073');
      d3.select(`#down-btn-${d.cluster}`).attr('fill', '#989aac');
      Model.adjust_weight(+d.id, true)
    }
    that.decrease_weight = function(d) {
      d3.select(`#up-btn-${d.cluster}`).attr('fill', '#989aac');
      d3.select(`#down-btn-${d.cluster}`).attr('fill', '#5d6073');
      Model.adjust_weight(+d.id, false)
    }
};
