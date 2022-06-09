function set_up() {
  const modes = ["coverage", "margin", "label", "pred", "diff", "coverage_uncertain", "margin_uncertain", "pred_diff"];
  const DR_methods = ["TSNE", "MDS"];
  const matrix_cell_info = [
    "margin_relation",
    "coverage_relation",
    "ind_margin_relation",
    "ind_coverage_relation",
    "all_margin_relation",
    "all_coverage_relation",
    "ensemble_pred",
  ];
  LabelCluster = new LabelCluster();
  LearnerCluster = new LearnerCluster();
  DataLoader = new DataLoaderClass();
  DataLoader.init(datasets[dataset_idx]);
  Scatterplot = new Scatterplot();
  Model = new Model();
  Matrix = new Matrix();

  Highlight = new Highlight();
  $("#get-data").on("click", DataLoader.get_data_onclick);
  $("#recommend-learner").on("click", Model.recommend_learner);
  $("#recommend-shot").on("click", Model.recommend_shot);
  $("#update-model").on("click", Model.update_model);

  $("#select-scatterplot-mode")
    .html(modes.map((x) => "<option>" + x + "</option>").join(""))
    .selectpicker("refresh");
  $("#select-scatterplot-mode").on("change", function (e) {
    Scatterplot.set_color_mode(modes.indexOf($("#select-scatterplot-mode").val()));
  });
  $("#select-scatterplot-mode").selectpicker("val", "margin_uncertain");
  Scatterplot.margin_filter = document.getElementById("margin-filter");
  noUiSlider.create(Scatterplot.margin_filter, {
    start: [0, 1],
    range: {
      min: [0],
      max: [1],
    },
    connect: true,
    tooltips: true,
  });
  Scatterplot.learner_filter = document.getElementById("learner-filter");
  noUiSlider.create(Scatterplot.learner_filter, {
    start: [0, 16],
    step: 1,
    range: {
      min: [0],
      max: [16],
    },
    format: {
        from: value => parseInt(value),
        to: value => parseInt(value),
    },
    connect: true,
    tooltips: true,
  });

  Scatterplot.learner_filter.noUiSlider.on("change", Scatterplot.refresh_color);
  Scatterplot.margin_filter.noUiSlider.on("change", Scatterplot.refresh_color);
}

$(document).ready(function () {
  tourFlag = false;
  set_up();
});


function begin_tour() {
  if (tourFlag) {
    tourFlag = false;
    introJs().setOptions({
      steps: [
        {
          intro: "Welcom FSLDiagnotor, a visual analysis tool to help improve ensemble-based few-shot classifier.",
        },
        {
          element: document.querySelector('#matrix-row'),
          intro: "The learner view compares base learners (rows) with the ensemble model on different classes (columns).",
          position: 'right'
        },
        {
          element: document.querySelector('#rect4'),
          intro: "Each cell discloses the agreements and differences between the predictions.",
          position: 'top'
        },
        {
          element: document.querySelector('#scatterplot'),
          intro: "The sample view visualizes the shots (stars) and unlabeled samples (circles) in context.",
          position: 'left'
        },
        {
          element: document.querySelector('#shot-cards-div'),
          intro: "Users examine the detailed contents and label the samples.",
          position: 'left'
        },
    ]
    }).start();
  }
}