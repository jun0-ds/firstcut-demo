/* FirstCut Demo - app.js */

(function () {
  "use strict";

  let DATA = null;
  let simChart = null;
  let biasChart = null;
  let gradeAccuracyChart = null;
  let distChart = null;
  let DIST_DATA = null; // 실제 도수분포 데이터

  // --- State ---
  let simSubject = "국어";

  const SAMPLE_SIZES = [50, 100, 200, 500, 1000, 2000, 5000];
  const MEGA_ERROR_LOW = 2;
  const MEGA_ERROR_HIGH = 3;

  // 수정 2: 2개 시나리오만
  const BIAS_LABELS = {
    random: "모든 성적대가 골고루 제출",
    mixed_bias: "실제와 비슷한 상황",
  };

  const BIAS_ICONS = {
    random: "\u2705",
    mixed_bias: "\u26A0\uFE0F",
  };

  const BIAS_SUBS = {
    random: "(이상적인 경우)",
    mixed_bias: "(상위권이 더 많이, 하위권이 더 적게 제출)",
  };

  const CHART_COLORS = [
    "#3b82f6", "#f59e0b",
  ];

  // Light theme chart colors
  const CHART_TICK_COLOR = "#64748b";
  const CHART_GRID_COLOR = "rgba(0,0,0,0.08)";
  const CHART_LEGEND_COLOR = "#475569";

  // 수정 3: 등급별 정확도 데이터 (하드코딩)
  const GRADE_ACCURACY_DATA = [
    { grade: "1등급", korean: 3.46, math: 4.01, colorClass: "grade-green" },
    { grade: "2등급", korean: 4.48, math: 5.38, colorClass: "grade-green" },
    { grade: "3등급", korean: 6.44, math: 7.07, colorClass: "grade-yellow" },
    { grade: "4등급", korean: 9.49, math: 11.00, colorClass: "grade-red" },
    { grade: "5등급", korean: 9.53, math: 12.53, colorClass: "grade-red" },
  ];

  // 2026 수능 표준→원 근사 변환 (과목별)
  // 국어/수학: 등급컷 기반 매핑, 탐구: 만점(50)↔최고표준 + 1등급컷 앵커 선형역산
  var STD_TO_RAW_MAPPINGS = {
    "국어": [
      [147, 100], [133, 91], [126, 85], [117, 77],
      [107, 67], [94, 56], [83, 46], [73, 37], [66, 31]
    ],
    "수학": [
      [139, 100], [133, 96], [127, 88], [121, 80],
      [112, 68], [100, 56], [88, 44], [78, 35], [68, 27]
    ],
    "물리학Ⅰ": [
      [70, 50], [66, 47], [60, 42], [55, 39],
      [50, 35], [45, 31], [40, 28], [35, 24]
    ],
    "화학Ⅰ": [
      [71, 50], [67, 45], [61, 38], [56, 31],
      [51, 25], [46, 19], [41, 12], [36, 6]
    ],
    "생명과학Ⅰ": [
      [74, 50], [67, 43], [64, 40], [59, 35],
      [54, 30], [49, 25], [44, 20], [39, 15], [35, 11]
    ],
    "지구과학Ⅰ": [
      [68, 50], [65, 44], [60, 34], [55, 24],
      [50, 14], [45, 4], [43, 0]
    ],
    "생활과 윤리": [
      [71, 50], [66, 44], [61, 38], [56, 32],
      [51, 26], [46, 20], [41, 14], [36, 8]
    ],
    "사회·문화": [
      [70, 50], [65, 43], [60, 36], [55, 29],
      [50, 22], [45, 15], [40, 8], [35, 1]
    ],
    "한국지리": [
      [72, 50], [68, 46], [62, 40], [57, 35],
      [52, 30], [47, 25], [42, 20], [37, 15]
    ],
    "세계지리": [
      [73, 50], [68, 46], [63, 42], [58, 38],
      [53, 34], [48, 30], [43, 26], [38, 22], [35, 20]
    ]
  };

  function standardToRaw(stdScore, subject) {
    var mapping = STD_TO_RAW_MAPPINGS[subject];
    if (!mapping) return stdScore; // 탐구 등 매핑 없으면 표준점수 그대로
    // 선형보간
    for (var i = 0; i < mapping.length - 1; i++) {
      var s1 = mapping[i][0], r1 = mapping[i][1];
      var s2 = mapping[i + 1][0], r2 = mapping[i + 1][1];
      if (stdScore >= s2 && stdScore <= s1) {
        var ratio = (stdScore - s2) / (s1 - s2);
        return Math.round(r2 + ratio * (r1 - r2));
      }
    }
    if (stdScore > mapping[0][0]) return mapping[0][1];
    return mapping[mapping.length - 1][1];
  }

  // --- Init ---
  async function init() {
    try {
      const resp = await fetch("data.json");
      DATA = await resp.json();
    } catch (e) {
      console.error("data.json load failed:", e);
      document.body.innerHTML =
        '<div style="padding:4rem;text-align:center;color:#ef4444;">data.json을 불러올 수 없습니다.</div>';
      return;
    }

    // 도수분포 데이터 로드
    try {
      const distResp = await fetch("dist_data.json");
      DIST_DATA = await distResp.json();
    } catch (e) {
      console.warn("dist_data.json load failed:", e);
    }

    setupSimulation();
    setupBias();
    setupGradeAccuracy();
    setupDistAnimation();
  }

  // =====================
  // Section 2: Simulation
  // =====================
  function setupSimulation() {
    const tabs = document.querySelectorAll("#sim-tabs .tab-btn");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        simSubject = btn.dataset.subject;
        renderSimulation();
      });
    });

    const slider = document.getElementById("sample-slider");
    slider.addEventListener("input", () => renderSimulation());

    renderSimulation();
  }

  function renderSimulation() {
    const slider = document.getElementById("sample-slider");
    const idx = parseInt(slider.value);
    const subjectData = DATA.simulation[simSubject];
    if (!subjectData) return;

    // Update slider label
    const currentN = subjectData[idx]
      ? subjectData[idx].sample_size
      : SAMPLE_SIZES[idx];
    document.getElementById("slider-val").textContent =
      currentN.toLocaleString() + "명";

    // Update result boxes
    const current = subjectData[idx];
    if (current) {
      const mae = current.mae;
      const maeEl = document.getElementById("mae-val");
      maeEl.textContent = "\u00B1" + mae.toFixed(2) + "점";
      maeEl.className = "value " + (mae <= 1 ? "good" : mae <= 2 ? "warn" : "bad");

      const megaAvg = (MEGA_ERROR_LOW + MEGA_ERROR_HIGH) / 2;
      const pct = Math.round((1 - mae / megaAvg) * 100);
      const megaEl = document.getElementById("mega-compare");
      megaEl.textContent = pct > 0 ? pct + "% 더 정확" : "유사";
      megaEl.className = "value " + (pct > 30 ? "good" : pct > 0 ? "warn" : "bad");

      document.getElementById("ci-val").textContent =
        current.ci_lower.toFixed(1) + " ~ " + current.ci_upper.toFixed(1) + "점 사이";
    }

    // Chart
    const labels = subjectData.map((d) => d.sample_size.toLocaleString());
    const maes = subjectData.map((d) => d.mae);

    const ctx = document.getElementById("sim-chart").getContext("2d");
    if (simChart) simChart.destroy();

    simChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "예측 오차 (점)",
            data: maes,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.08)",
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointRadius: maes.map((_, i) => (i === idx ? 8 : 4)),
            pointBackgroundColor: maes.map((_, i) =>
              i === idx ? "#2563eb" : "#3b82f6"
            ),
          },
          {
            label: "업계 1위 오차 하한 (2점)",
            data: Array(labels.length).fill(MEGA_ERROR_LOW),
            borderColor: "rgba(220,38,38,0.5)",
            borderDash: [8, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
          {
            label: "업계 1위 오차 상한 (3점)",
            data: Array(labels.length).fill(MEGA_ERROR_HIGH),
            borderColor: "rgba(220,38,38,0.3)",
            borderDash: [8, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: {
              target: "-1",
              above: "rgba(220,38,38,0.05)",
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            labels: { color: CHART_LEGEND_COLOR, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + ctx.parsed.y.toFixed(3) + "점",
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "데이터 수 (명)", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR },
            grid: { color: CHART_GRID_COLOR },
          },
          y: {
            title: { display: true, text: "예측 오차 (점)", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR },
            grid: { color: CHART_GRID_COLOR },
            min: 0,
          },
        },
      },
    });
  }

  // =====================
  // Section 3: Bias (수정 2: 2개만)
  // =====================
  function setupBias() {
    renderBias();
  }

  function renderBias() {
    // 국어 기준 고정
    const biasData = DATA.bias_comparison["국어"];
    if (!biasData) return;

    // Use sample_size=1000 for the summary cards
    const targetN = 1000;
    const grid = document.getElementById("bias-grid");
    grid.innerHTML = "";

    // 2개만: random, mixed_bias
    const biasKeys = ["random", "mixed_bias"];
    biasKeys.forEach((key, idx) => {
      const items = biasData[key];
      const item = items.find((d) => d.sample_size === targetN) || items[items.length - 1];
      const card = document.createElement("div");
      card.className = "bias-card" + (key === "mixed_bias" ? " bias-highlight" : "");
      const mae = item.mae;
      const colorClass = mae <= 1.5 ? "good" : mae <= 3 ? "warn" : "bad";
      const icon = BIAS_ICONS[key] || "";
      card.innerHTML =
        '<div class="bias-name">' + (BIAS_LABELS[key] || key) + "</div>" +
        '<div class="bias-mae value ' + colorClass + '">\u00B1' + mae.toFixed(2) + "점 " + icon + "</div>" +
        '<div class="bias-sub">' + (BIAS_SUBS[key] || "") + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.25rem;">' +
        item.sample_size.toLocaleString() + "명 기준</div>" +
        (key === "mixed_bias" ? '<div class="bias-warning">보정 없이는 예측 정확도가 크게 떨어집니다</div>' : "");
      grid.appendChild(card);
    });

    // Chart: grouped bar by sample size (2개만)
    const sampleSizes = biasData[biasKeys[0]].map((d) => d.sample_size.toLocaleString() + "명");
    const datasets = biasKeys.map((key, i) => ({
      label: BIAS_LABELS[key] || key,
      data: biasData[key].map((d) => d.mae),
      backgroundColor: CHART_COLORS[i],
      borderRadius: 4,
    }));

    const ctx = document.getElementById("bias-chart").getContext("2d");
    if (biasChart) biasChart.destroy();

    biasChart = new Chart(ctx, {
      type: "bar",
      data: { labels: sampleSizes, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: CHART_LEGEND_COLOR } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": \u00B1" + ctx.parsed.y.toFixed(3) + "점",
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "데이터 수", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR },
            grid: { color: CHART_GRID_COLOR },
          },
          y: {
            title: { display: true, text: "예측 오차 (점)", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR },
            grid: { color: CHART_GRID_COLOR },
            min: 0,
          },
        },
      },
    });
  }

  // =====================
  // Section 3.3: Grade Accuracy (수정 3)
  // =====================
  function setupGradeAccuracy() {
    const gridEl = document.getElementById("grade-accuracy-grid");
    if (!gridEl) return;

    // 카드 렌더링
    gridEl.innerHTML = "";
    GRADE_ACCURACY_DATA.forEach((item) => {
      const card = document.createElement("div");
      card.className = "grade-card " + item.colorClass;
      card.innerHTML =
        '<div class="grade-label">' + item.grade + '</div>' +
        '<div class="grade-values">' +
          '<div class="subj-line"><span class="subj-name">국어</span><span class="subj-score">\u00B1' + item.korean.toFixed(2) + '</span></div>' +
          '<div class="subj-line"><span class="subj-name">수학</span><span class="subj-score">\u00B1' + item.math.toFixed(2) + '</span></div>' +
        '</div>' +
        '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.35rem;">표준점수 기준</div>';
      gridEl.appendChild(card);
    });

    // 가로 막대 차트
    renderGradeAccuracyChart();
  }

  function renderGradeAccuracyChart() {
    const ctx = document.getElementById("grade-accuracy-chart");
    if (!ctx) return;

    if (gradeAccuracyChart) gradeAccuracyChart.destroy();

    const labels = GRADE_ACCURACY_DATA.map((d) => d.grade);
    const koreanData = GRADE_ACCURACY_DATA.map((d) => d.korean);
    const mathData = GRADE_ACCURACY_DATA.map((d) => d.math);

    const barColors = ["#16a34a", "#16a34a", "#d97706", "#dc2626", "#dc2626"];

    gradeAccuracyChart = new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "국어",
            data: koreanData,
            backgroundColor: barColors.map((c) => c + "cc"),
            borderColor: barColors,
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "수학",
            data: mathData,
            backgroundColor: barColors.map((c) => c + "66"),
            borderColor: barColors,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: CHART_LEGEND_COLOR } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": \u00B1" + ctx.parsed.x.toFixed(2) + "점",
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "예측 오차 (점)", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR },
            grid: { color: CHART_GRID_COLOR },
            min: 0,
          },
          y: {
            ticks: { color: CHART_TICK_COLOR },
            grid: { display: false },
          },
        },
      },
    });
  }

  // =====================
  // Section 3.5: Distribution Animation (수정 5)
  // =====================
  function setupDistAnimation() {
    const betterCards = document.querySelectorAll(".better-card");
    if (betterCards.length === 0) return;

    // 첫 번째 카드를 기본 활성
    betterCards[0].classList.add("better-active");
    renderDistChart("no-bias");

    betterCards.forEach((card, i) => {
      card.addEventListener("click", () => {
        betterCards.forEach((c) => c.classList.remove("better-active"));
        card.classList.add("better-active");

        const scenarios = ["no-bias", "with-bias", "corrected"];
        renderDistChart(scenarios[i] || "no-bias");
      });
    });
  }

  function generateDistData(scenario) {
    if (!DIST_DATA || !DIST_DATA["국어"]) return null;

    const raw = DIST_DATA["국어"];
    // scores는 내림차순(147→116), 차트에서는 오름차순(116→147)으로 표시
    const scores = [...raw.scores].reverse();
    const counts = [...raw.counts].reverse();

    const ACTUAL_CUT = 133; // 2026 수능 국어 실제 1등급컷

    let displayCounts;
    let predictCut;

    if (scenario === "no-bias") {
      // 원래 분포 그대로 → 예측과 실제가 거의 일치
      displayCounts = [...counts];
      predictCut = ACTUAL_CUT;
    } else if (scenario === "with-bias") {
      // 상위권 쏠림: 높은 점수일수록 과대 대표 → 분포 모양이 오른쪽으로 부풀어짐
      displayCounts = counts.map((c, i) => {
        const score = scores[i];
        if (score >= ACTUAL_CUT) {
          const boost = 1.6 + (score - ACTUAL_CUT) * 0.06;
          return Math.round(c * Math.min(boost, 2.5));
        }
        return c;
      });
      // 쏠린 샘플로 예측 → 예측컷이 실제보다 낮게(왼쪽으로) 밀림
      predictCut = ACTUAL_CUT - 3;
    } else {
      // 보정 후: 거의 원래 분포로 복원, 약간의 잔여 차이
      displayCounts = counts.map((c, i) => {
        const score = scores[i];
        if (score >= ACTUAL_CUT) {
          const residual = 1.0 + (score - ACTUAL_CUT) * 0.01;
          return Math.round(c * Math.min(residual, 1.15));
        }
        return c;
      });
      // 보정 후 예측컷이 실제에 근접
      predictCut = ACTUAL_CUT - 1;
    }

    return {
      labels: scores,
      values: displayCounts,
      actualCut: ACTUAL_CUT,
      predictCut: predictCut,
    };
  }

  function renderDistChart(scenario) {
    const canvas = document.getElementById("dist-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (distChart) distChart.destroy();

    const data = generateDistData(scenario);
    if (!data) return;

    // 세로선 플러그인
    const verticalLinePlugin = {
      id: "verticalLines",
      afterDraw: function (chart) {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const chartCtx = chart.ctx;

        // 실제 1등급컷 (빨간 세로선)
        const actualIdx = data.labels.indexOf(data.actualCut);
        if (actualIdx < 0) return;
        const actualX = xScale.getPixelForValue(actualIdx);
        chartCtx.save();
        chartCtx.beginPath();
        chartCtx.strokeStyle = "#dc2626";
        chartCtx.lineWidth = 2;
        chartCtx.setLineDash([6, 3]);
        chartCtx.moveTo(actualX, yScale.top);
        chartCtx.lineTo(actualX, yScale.bottom);
        chartCtx.stroke();

        // 라벨
        chartCtx.fillStyle = "#dc2626";
        chartCtx.font = "bold 11px sans-serif";
        chartCtx.textAlign = "center";
        chartCtx.fillText("실제 1등급컷", actualX, yScale.top - 8);

        // 예측 1등급컷 (파란 세로선)
        const predictIdx = data.labels.indexOf(data.predictCut);
        if (predictIdx >= 0) {
          const predictX = xScale.getPixelForValue(predictIdx);
          chartCtx.beginPath();
          chartCtx.strokeStyle = "#2563eb";
          chartCtx.lineWidth = 2;
          chartCtx.setLineDash([6, 3]);
          chartCtx.moveTo(predictX, yScale.top);
          chartCtx.lineTo(predictX, yScale.bottom);
          chartCtx.stroke();

          chartCtx.fillStyle = "#2563eb";
          chartCtx.fillText("예측 1등급컷", predictX, yScale.top - 20);
        }

        chartCtx.restore();
      },
    };

    // y축 고정: 쏠림 있을 때 부풀림이 시각적으로 보이도록 원본 분포 기준으로 고정
    const rawCounts = [...DIST_DATA["국어"].counts];
    const maxVal = Math.max(...rawCounts);

    distChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels.map(String),
        datasets: [
          {
            label: "인원 수",
            data: data.values,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.12)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      plugins: [verticalLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 800,
          easing: "easeInOutQuart",
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            display: true,
            title: { display: true, text: "점수", font: { size: 12 } },
            ticks: {
              maxTicksLimit: 8,
              font: { size: 10 },
            },
            grid: { display: false },
          },
          y: {
            display: true,
            title: { display: true, text: "인원", font: { size: 12 } },
            min: 0,
            max: Math.round(maxVal * 1.2),
            ticks: {
              maxTicksLimit: 5,
              font: { size: 10 },
              callback: function (v) {
                return v >= 1000 ? (v / 1000).toFixed(1) + "k" : v;
              },
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
        layout: {
          padding: { top: 30 },
        },
      },
    });
  }

  // =====================
  // Section 3.7: Sample Data Buttons
  // =====================

  function setupSampleButtons() {
    var buttons = document.querySelectorAll(".sample-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        // Mark active
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");

        var n = parseInt(btn.dataset.n);
        runSampleAnalysis(n);
      });
    });
  }

  function buildPopulationArray(subject) {
    // dist_data.json의 해당 과목 데이터로 모집단 배열 생성
    if (!DIST_DATA || !DIST_DATA[subject]) return null;
    var raw = DIST_DATA[subject];
    var population = [];
    for (var i = 0; i < raw.scores.length; i++) {
      for (var j = 0; j < raw.counts[i]; j++) {
        population.push(raw.scores[i]);
      }
    }
    return population;
  }

  function sampleFromPopulation(population, n) {
    // Fisher-Yates partial shuffle for sampling
    var pool = population.slice();
    var result = [];
    var len = pool.length;
    for (var i = 0; i < n && i < len; i++) {
      var r = i + Math.floor(Math.random() * (len - i));
      var tmp = pool[i];
      pool[i] = pool[r];
      pool[r] = tmp;
      result.push(pool[i]);
    }
    return result;
  }

  // 예시 데이터 10과목 목록
  var SAMPLE_SUBJECTS = [
    "국어", "수학",
    "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ",
    "생활과 윤리", "사회·문화", "한국지리", "세계지리"
  ];

  function runSampleAnalysis(n) {
    _isSampleMode = true;
    var grouped = {};
    var missing = [];

    SAMPLE_SUBJECTS.forEach(function (subject) {
      var population = buildPopulationArray(subject);
      if (!population) {
        missing.push(subject);
        return;
      }
      var sampleStd = sampleFromPopulation(population, n);
      // 표준점수 → 원점수 변환 (국어/수학만 변환, 탐구는 그대로)
      var sample = sampleStd.map(function (s) { return standardToRaw(s, subject); });
      grouped[subject] = sample;
    });

    if (Object.keys(grouped).length === 0) {
      console.error("dist_data.json 데이터 없음", missing);
      return;
    }

    // 기존 분석 파이프라인에 전달
    parsedData = grouped;

    // 분석 중 표시
    var valCard = document.getElementById("validation-card");
    valCard.style.display = "block";
    var totalScores = 0;
    for (var k in grouped) totalScores += grouped[k].length;
    var delay = Math.min(500 + totalScores * 0.4, 3000);
    document.getElementById("validation-msg").innerHTML = '<div style="text-align:center;padding:1rem;"><strong style="color:var(--primary);">시뮬레이션 분석 중...</strong><div class="progress-bar-wrap"><div class="progress-bar-fill" id="sim-progress"></div></div></div>';
    document.getElementById("analysis-results").style.display = "none";
    var progBar = document.getElementById("sim-progress");
    if (progBar) { progBar.style.transition = "width " + (delay / 1000) + "s ease"; setTimeout(function(){ progBar.style.width = "100%"; }, 50); }

    setTimeout(function () {
      valCard.style.display = "none";
      showResults(grouped);
    }, delay);
  }

  // =====================
  // Section 3.7: Try-It (Upload & Analyze)
  // =====================

  let histChart = null;
  let parsedData = null; // { subject: [scores...], ... }

  // 과목 이름 매핑 (유사한 이름도 인식)
  const SUBJECT_ALIASES = {
    "국어": "국어", "국": "국어", "korean": "국어",
    "수학": "수학", "수": "수학", "math": "수학",
    "물리학ⅰ": "물리학Ⅰ", "물리학i": "물리학Ⅰ", "물리학1": "물리학Ⅰ", "물리1": "물리학Ⅰ", "물리": "물리학Ⅰ", "물리학": "물리학Ⅰ", "physics": "물리학Ⅰ",
    "화학ⅰ": "화학Ⅰ", "화학i": "화학Ⅰ", "화학1": "화학Ⅰ", "화학": "화학Ⅰ", "chemistry": "화학Ⅰ",
    "생명과학ⅰ": "생명과학Ⅰ", "생명과학i": "생명과학Ⅰ", "생명과학1": "생명과학Ⅰ", "생명과학": "생명과학Ⅰ", "생명": "생명과학Ⅰ", "생과": "생명과학Ⅰ", "biology": "생명과학Ⅰ",
    "지구과학ⅰ": "지구과학Ⅰ", "지구과학i": "지구과학Ⅰ", "지구과학1": "지구과학Ⅰ", "지구과학": "지구과학Ⅰ", "지과": "지구과학Ⅰ", "earthscience": "지구과학Ⅰ",
    "생활과윤리": "생활과 윤리", "생활과 윤리": "생활과 윤리", "생윤": "생활과 윤리",
    "사회문화": "사회·문화", "사회·문화": "사회·문화", "사회 문화": "사회·문화", "사문": "사회·문화",
    "한국지리": "한국지리", "한지": "한국지리",
    "세계지리": "세계지리", "세지": "세계지리",
  };

  // 비-과목 컬럼 이름 (wide 형태에서 무시할 컬럼)
  const NON_SUBJECT_COLUMNS = new Set([
    "학생번호", "번호", "이름", "학번", "no", "id", "student", "student_id", "name"
  ]);

  function normalizeSubjectName(raw) {
    var key = raw.trim().toLowerCase().replace(/\s+/g, "");
    // 직접 매칭
    if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key];
    // 원래 이름에서 공백 제거한 것도 시도
    var keyWithSpaces = raw.trim().toLowerCase();
    if (SUBJECT_ALIASES[keyWithSpaces]) return SUBJECT_ALIASES[keyWithSpaces];
    // 원문 그대로 반환 (인식 불가)
    return null;
  }

  function isNonSubjectColumn(name) {
    return NON_SUBJECT_COLUMNS.has(name.trim().toLowerCase().replace(/\s+/g, ""));
  }

  function setupTryIt() {
    var uploadZone = document.getElementById("upload-zone");
    var fileInput = document.getElementById("file-input");
    var templateBtn = document.getElementById("download-template");

    if (!uploadZone) return;

    // 템플릿 다운로드
    if (templateBtn) {
      templateBtn.addEventListener("click", function () {
        generateTemplate();
      });
    }

    // 드래그앤드롭 (이벤트 중복 방지)
    if (!uploadZone._clickBound) {
      uploadZone.addEventListener("click", function (e) {
        e.stopPropagation();
        fileInput.click();
      });
      uploadZone._clickBound = true;
    }

    uploadZone.addEventListener("dragover", function (e) {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    });

    uploadZone.addEventListener("dragleave", function () {
      uploadZone.classList.remove("dragover");
    });

    uploadZone.addEventListener("drop", function (e) {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", function () {
      if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });

    // 결과 이미지 저장
    var saveBtn = document.getElementById("save-image-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        saveResultImage();
      });
    }

    // 다시 업로드
    var resetBtn = document.getElementById("reset-upload-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetUpload();
      });
    }
  }

  function generateTemplate() {
    // Wide 형태 템플릿: 학생번호 + 10과목 열, 50명
    var subjects = ["국어", "수학", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ", "생활과 윤리", "사회·문화", "한국지리", "세계지리"];
    var header = ["학생번호"].concat(subjects);

    // 수정 1: 원점수 범위 (국어/수학 60~100, 탐구 25~50)
    var scoreRanges = {
      "국어": [60, 100], "수학": [60, 100],
      "물리학Ⅰ": [25, 50], "화학Ⅰ": [25, 50],
      "생명과학Ⅰ": [25, 50], "지구과학Ⅰ": [25, 50],
      "생활과 윤리": [25, 50], "사회·문화": [25, 50],
      "한국지리": [25, 50], "세계지리": [25, 50],
    };

    // 학생별 선택과목 패턴 (현실적으로: 국어+수학은 거의 전원, 탐구는 2과목)
    var rows = [header];
    for (var i = 1; i <= 50; i++) {
      var row = [i];
      // 국어, 수학은 전원 응시
      for (var j = 0; j < 2; j++) {
        var range = scoreRanges[subjects[j]];
        row.push(Math.round(range[0] + Math.random() * (range[1] - range[0])));
      }
      // 탐구 8과목 중 2개만 랜덤 선택
      var exploratoryIndices = [2, 3, 4, 5, 6, 7, 8, 9];
      // 셔플 후 2개만 선택
      for (var k = exploratoryIndices.length - 1; k > 0; k--) {
        var r = Math.floor(Math.random() * (k + 1));
        var tmp = exploratoryIndices[k];
        exploratoryIndices[k] = exploratoryIndices[r];
        exploratoryIndices[r] = tmp;
      }
      var chosen = new Set([exploratoryIndices[0], exploratoryIndices[1]]);

      for (var j = 2; j < subjects.length; j++) {
        if (chosen.has(j)) {
          var range = scoreRanges[subjects[j]];
          row.push(Math.round(range[0] + Math.random() * (range[1] - range[0])));
        } else {
          row.push(""); // 미응시
        }
      }
      rows.push(row);
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "자기채점");
    XLSX.writeFile(wb, "firstcut_template.xlsx");
  }

  function handleFile(file) {
    _isSampleMode = false;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: "array" });
        var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        validateAndProcess(jsonData);
      } catch (err) {
        showValidation(false, ["파일을 읽을 수 없습니다. 엑셀(.xlsx) 파일인지 확인해주세요."]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 데이터 형식 자동 감지: 컬럼 2개면 long, 3개 이상이면 wide
  function detectFormat(header) {
    // 유효 컬럼 수 (빈 문자열 제외)
    var validCols = header.filter(function (h) {
      return h !== undefined && h !== null && String(h).trim() !== "";
    });
    if (validCols.length <= 2) return "long";
    return "wide";
  }

  function validateAndProcess(rows) {
    if (rows.length < 2) {
      showValidation(false, ["데이터가 비어있습니다. 최소 1행의 데이터가 필요합니다."]);
      return;
    }

    var header = rows[0];
    var format = detectFormat(header);

    if (format === "long") {
      validateAndProcessLong(rows);
    } else {
      validateAndProcessWide(rows);
    }
  }

  // 기존 long 형태 파싱 (하위 호환)
  function validateAndProcessLong(rows) {
    var header = rows[0];
    var subjectCol = -1;
    var scoreCol = -1;

    for (var i = 0; i < header.length; i++) {
      var h = String(header[i]).trim().toLowerCase();
      if (h === "과목" || h === "subject") subjectCol = i;
      if (h === "점수" || h === "score" || h === "원점수" || h === "raw_score" || h === "표준점수" || h === "standard_score") scoreCol = i;
    }

    if (subjectCol === -1 || scoreCol === -1) {
      showValidation(false, [
        "컬럼을 찾을 수 없습니다.",
        "'과목'과 '점수' 컬럼이 필요합니다. 첫 번째 행이 컬럼 이름인지 확인해주세요."
      ]);
      return;
    }

    var errors = [];
    var grouped = {};
    var unknownSubjects = {};
    var totalValid = 0;

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.length === 0) continue;

      var rawSubject = row[subjectCol];
      var rawScore = row[scoreCol];

      if (rawSubject === undefined || rawSubject === null || String(rawSubject).trim() === "") continue;

      var subject = normalizeSubjectName(String(rawSubject));
      var score = parseFloat(rawScore);

      if (subject === null) {
        unknownSubjects[String(rawSubject).trim()] = true;
        continue;
      }

      if (isNaN(score)) {
        errors.push((r + 1) + "행의 점수가 비어있거나 숫자가 아닙니다.");
        continue;
      }

      // 수정 1: 원점수 범위 검증
      var isMainSubject = (subject === "국어" || subject === "수학");
      var maxScore = isMainSubject ? 100 : 50;
      if (score < 0 || score > maxScore) {
        errors.push((r + 1) + "행의 점수(" + score + ")가 범위를 벗어납니다. (0~" + maxScore + ")");
        continue;
      }

      if (!grouped[subject]) grouped[subject] = [];
      grouped[subject].push(score);
      totalValid++;
    }

    finishValidation(grouped, totalValid, errors, Object.keys(unknownSubjects));
  }

  // 새로운 wide 형태 파싱
  function validateAndProcessWide(rows) {
    var header = rows[0];
    var errors = [];
    var grouped = {};
    var unknownSubjects = {};
    var totalValid = 0;

    // 헤더에서 과목 컬럼 매핑
    var colMapping = []; // [{colIdx, subjectName}]
    for (var c = 0; c < header.length; c++) {
      var colName = String(header[c] || "").trim();
      if (colName === "") continue;
      if (isNonSubjectColumn(colName)) continue;

      var normalized = normalizeSubjectName(colName);
      if (normalized === null) {
        unknownSubjects[colName] = true;
        continue;
      }
      colMapping.push({ colIdx: c, subjectName: normalized });
    }

    if (colMapping.length === 0) {
      showValidation(false, [
        "인식 가능한 과목명이 헤더에 없습니다.",
        "첫 번째 행에 과목명(국어, 수학, 물리학I 등)이 있는지 확인해주세요."
      ]);
      return;
    }

    // 각 행을 (과목, 점수) 쌍으로 변환
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.length === 0) continue;

      // 행이 완전히 비어있는지 확인
      var hasAnyValue = false;
      for (var k = 0; k < row.length; k++) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
          hasAnyValue = true;
          break;
        }
      }
      if (!hasAnyValue) continue;

      for (var m = 0; m < colMapping.length; m++) {
        var mapping = colMapping[m];
        var rawScore = row[mapping.colIdx];

        // 빈칸 = 미응시 (정상적으로 건너뜀)
        if (rawScore === undefined || rawScore === null || String(rawScore).trim() === "") continue;

        var score = parseFloat(rawScore);

        if (isNaN(score)) {
          errors.push((r + 1) + "행 '" + mapping.subjectName + "' 점수가 숫자가 아닙니다.");
          continue;
        }

        // 수정 1: 원점수 범위 검증
        var isMainSubject = (mapping.subjectName === "국어" || mapping.subjectName === "수학");
        var maxScore = isMainSubject ? 100 : 50;
        if (score < 0 || score > maxScore) {
          errors.push((r + 1) + "행 '" + mapping.subjectName + "' 점수(" + score + ")가 범위를 벗어납니다. (0~" + maxScore + ")");
          continue;
        }

        if (!grouped[mapping.subjectName]) grouped[mapping.subjectName] = [];
        grouped[mapping.subjectName].push(score);
        totalValid++;
      }
    }

    finishValidation(grouped, totalValid, errors, Object.keys(unknownSubjects));
  }

  function finishValidation(grouped, totalValid, errors, unknownList) {
    var subjectCount = Object.keys(grouped).length;
    var recognizedSubjects = Object.keys(grouped);

    // 인식 성공/실패 메시지 구성
    var summaryMessages = [];

    if (recognizedSubjects.length > 0) {
      summaryMessages.push("\u2705 " + recognizedSubjects.join(", ") + " (" + subjectCount + "개 과목 인식)");
    }

    if (unknownList.length > 0) {
      summaryMessages.push("\u26A0\uFE0F 인식하지 못한 컬럼: " + unknownList.join(", ") + " (분석에서 제외됨)");
    }

    if (totalValid === 0) {
      var allMessages = summaryMessages.concat(errors.length > 0 ? errors : ["유효한 데이터를 찾을 수 없습니다."]);
      showValidation(false, allMessages);
      return;
    }

    if (errors.length > 0 || unknownList.length > 0) {
      var warnMessages = summaryMessages.concat(errors).concat([
        "총 " + totalValid.toLocaleString() + "건 데이터를 분석합니다."
      ]);
      showValidation("warn", warnMessages);
    } else {
      summaryMessages.push("총 " + totalValid.toLocaleString() + "건 데이터를 확인했습니다.");
      showValidation(true, summaryMessages);
    }

    parsedData = grouped;

    // 분석 중 표시 + 데이터 수 비례 대기
    var totalScores = 0;
    for (var k in grouped) totalScores += grouped[k].length;
    var delay = Math.min(500 + totalScores * 0.4, 3000);

    var valCard2 = document.getElementById("validation-card");
    valCard2.style.display = "block";
    document.getElementById("validation-msg").innerHTML = '<div style="text-align:center;padding:1rem;"><strong style="color:var(--primary);">시뮬레이션 분석 중...</strong><div class="progress-bar-wrap"><div class="progress-bar-fill" id="sim-progress2"></div></div></div>';
    document.getElementById("analysis-results").style.display = "none";
    var progBar2 = document.getElementById("sim-progress2");
    if (progBar2) { progBar2.style.transition = "width " + (delay / 1000) + "s ease"; setTimeout(function(){ progBar2.style.width = "100%"; }, 50); }

    setTimeout(function () {
      valCard2.style.display = "none";
      showResults(grouped);
    }, delay);
  }

  function showValidation(success, messages) {
    var card = document.getElementById("validation-card");
    var msg = document.getElementById("validation-msg");
    card.style.display = "block";

    if (success === true) {
      msg.innerHTML = '<div class="validation-success">' +
        messages.map(function (m) { return '<div style="margin-bottom:0.25rem;">' + m + '</div>'; }).join("") +
        '</div>';
    } else if (success === "warn") {
      msg.innerHTML = '<div class="validation-warn"><ul>' +
        messages.map(function (m) { return "<li>" + m + "</li>"; }).join("") +
        '</ul></div>';
    } else {
      msg.innerHTML = '<div class="validation-error"><ul>' +
        messages.map(function (m) { return "<li>" + m + "</li>"; }).join("") +
        '</ul></div>';
    }
  }

  var _isSampleMode = false;

  function showResults(grouped) {
    // 업로드 카드는 축소하지 않음 (항상 보임)
    document.getElementById("analysis-results").style.display = "block";

    var avgData = DATA.meta.subject_averages || {};

    // 시뮬레이션 엔진 실행
    var simResults = runSimulationEngine(grouped);

    // 통합 요약 테이블 (시뮬레이션 결과 전달)
    renderSummaryTable(grouped, avgData, simResults, _isSampleMode);

    // 종합 분석 (축약, 시뮬레이션 결과 사용)
    renderInterpretation(grouped, avgData, simResults);

    // 히스토그램
    renderHistogramTabs(grouped);
  }

  // =====================
  // 시뮬레이션 엔진 (Python 코어 로직 포팅)
  // =====================

  // --- percentile 계산 (inference.py의 estimate_cutline 포팅) ---
  function computePercentile(arr, pct) {
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var idx = (pct / 100) * (sorted.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  // --- 부트스트랩 신뢰구간 (inference.py의 confidence_interval 포팅) ---
  function bootstrapCI(scores, pct, nBoot, confidence) {
    nBoot = nBoot || 300;
    confidence = confidence || 0.95;
    var len = scores.length;
    var estimates = [];
    for (var i = 0; i < nBoot; i++) {
      var resample = new Array(len);
      for (var j = 0; j < len; j++) {
        resample[j] = scores[Math.floor(Math.random() * len)];
      }
      estimates.push(computePercentile(resample, pct));
    }
    estimates.sort(function (a, b) { return a - b; });
    var alpha = (1 - confidence) / 2;
    return {
      lower: estimates[Math.floor(alpha * estimates.length)],
      estimate: estimates[Math.floor(0.5 * estimates.length)],
      upper: estimates[Math.floor((1 - alpha) * estimates.length)]
    };
  }

  // --- 편향 감지 (distribution.py 비교 로직 포팅) ---
  // 업로드 데이터는 원점수, dist_data.json은 표준점수이므로 원점수로 변환하여 비교
  function detectBias(scores, subject) {
    if (!DIST_DATA || !DIST_DATA[subject]) return null;

    var raw = DIST_DATA[subject];
    // 모집단을 원점수로 변환하여 통계 계산
    var popTotal = 0;
    var popSum = 0;
    var popScoresRaw = []; // 원점수 변환된 모집단
    for (var i = 0; i < raw.scores.length; i++) {
      var rawScore = standardToRaw(raw.scores[i], subject);
      popTotal += raw.counts[i];
      popSum += rawScore * raw.counts[i];
      for (var j = 0; j < raw.counts[i]; j++) {
        popScoresRaw.push(rawScore);
      }
    }
    var popMean = popSum / popTotal;

    // 모집단 상위 10% 임계점 (원점수 기준)
    popScoresRaw.sort(function (a, b) { return a - b; });
    var popTop10Threshold = computePercentile(popScoresRaw, 90);
    var popTop10Count = 0;
    for (var i = 0; i < popScoresRaw.length; i++) {
      if (popScoresRaw[i] >= popTop10Threshold) popTop10Count++;
    }
    var popTop10Ratio = popTop10Count / popTotal;

    // 업로드 데이터 통계 (이미 원점수)
    var sampleSum = 0;
    var sampleTop10Count = 0;
    for (var i = 0; i < scores.length; i++) {
      sampleSum += scores[i];
      if (scores[i] >= popTop10Threshold) sampleTop10Count++;
    }
    var sampleMean = sampleSum / scores.length;
    var sampleTop10Ratio = sampleTop10Count / scores.length;

    // 편향 판정
    var meanDiff = sampleMean - popMean;
    var top10Diff = sampleTop10Ratio - popTop10Ratio;
    var biased = (meanDiff > 3) || (top10Diff > 0.05);

    return {
      biased: biased,
      meanDiff: meanDiff,
      popMean: popMean,
      sampleMean: sampleMean,
      top10Diff: top10Diff,
      popTop10Ratio: popTop10Ratio,
      sampleTop10Ratio: sampleTop10Ratio
    };
  }

  // --- 과목별 시뮬레이션 실행 ---
  function runSimulationEngine(grouped) {
    var results = {};
    for (var subj in grouped) {
      var scores = grouped[subj];
      var n = scores.length;

      // 부트스트랩 기반 1등급컷 추정 + 신뢰구간
      var ci = bootstrapCI(scores, 96, 300, 0.95);

      // 편향 감지 (dist_data.json에 있는 과목)
      var bias = detectBias(scores, subj);

      results[subj] = {
        n: n,
        cutEstimate: Math.round(ci.estimate),
        ciLower: Math.round(ci.lower),
        ciUpper: Math.round(ci.upper),
        ciWidth: Math.round(ci.upper) - Math.round(ci.lower),
        bias: bias
      };
    }
    return results;
  }

  // --- 통합 요약 테이블 ---

  function findClosestMAE(subject, sampleSize) {
    var simData = DATA.simulation[subject];
    if (!simData) return null;
    var closest = null;
    var closestDist = Infinity;
    for (var i = 0; i < simData.length; i++) {
      var dist = Math.abs(simData[i].sample_size - sampleSize);
      if (dist < closestDist) {
        closestDist = dist;
        closest = simData[i];
      }
    }
    return closest;
  }

  // 2026 수능 실제 1등급컷 (원점수 기준)
  var ACTUAL_CUTLINES = {
    "국어": 91, "수학": 88, "물리학Ⅰ": 47, "화학Ⅰ": 45,
    "생명과학Ⅰ": 43, "지구과학Ⅰ": 44, "생활과 윤리": 44,
    "사회·문화": 43, "한국지리": 46, "세계지리": 46
  };

  function renderSummaryTable(grouped, avgData, simResults, isSample) {
    var container = document.getElementById("results-summary-table");
    var html = '<table class="results-summary-table">';
    if (isSample) {
      html += '<thead><tr><th>과목</th><th>데이터 수</th><th>1등급컷 예측</th><th>실제 1등급컷</th><th>예측 범위</th><th>신뢰도</th><th>비고</th></tr></thead>';
    } else {
      html += '<thead><tr><th>과목</th><th>데이터 수</th><th>1등급컷 예측</th><th>실제 1등급컷</th><th>예측 범위</th><th>신뢰도</th><th>비고</th></tr></thead>';
    }
    html += '<tbody>';

    var hasBiasWarning = false;
    var biasWarnings = [];

    for (var subj in grouped) {
      var scores = grouped[subj];
      var n = scores.length;
      var sim = simResults[subj];
      var avgRef = avgData[subj];

      // 1등급컷: 부트스트랩 중앙값
      var cutline = sim.cutEstimate;

      // 예측 범위 (신뢰구간)
      var ciText = sim.ciLower + " ~ " + sim.ciUpper + "점";

      // 신뢰도: CI 폭 기반
      var confText = "--";
      var confClass = "";
      if (sim.ciWidth <= 2) { confText = "높음"; confClass = "confidence-high"; }
      else if (sim.ciWidth <= 5) { confText = "보통"; confClass = "confidence-mid"; }
      else { confText = "낮음 (데이터 부족)"; confClass = "confidence-low"; }

      // 실제 1등급컷
      var actualText = "-";
      if (isSample && ACTUAL_CUTLINES[subj] !== undefined) {
        actualText = ACTUAL_CUTLINES[subj] + "점";
      } else if (!isSample) {
        actualText = '<span style="color:var(--text-muted);font-size:0.8rem;">미공개</span>';
      }

      // 비고
      var noteText = "";
      if (sim.bias && sim.bias.biased) {
        noteText = '<span style="color:#d97706;">⚠️ 쏠림 감지</span>';
      }

      html += '<tr>' +
        '<td><strong>' + subj + '</strong></td>' +
        '<td>' + n.toLocaleString() + '명</td>' +
        '<td><strong>' + cutline + '점</strong></td>' +
        '<td>' + actualText + '</td>' +
        '<td>' + ciText + '</td>' +
        '<td class="' + confClass + '">' + confText + '</td>' +
        '<td>' + noteText + '</td>' +
        '</tr>';

      // 편향 경고 수집
      if (sim.bias && sim.bias.biased) {
        hasBiasWarning = true;
        biasWarnings.push(subj);
      }
    }

    // 편향 감지 시 경고 행
    if (hasBiasWarning) {
      var colSpan = 7;
      html += '<tr class="bias-warning-row">' +
        '<td colspan="' + colSpan + '" style="background:#fef3c7;color:#92400e;padding:0.75rem;font-size:0.85rem;text-align:left;">' +
        '\u26A0\uFE0F 상위권 쏠림이 감지되었습니다 (' + biasWarnings.join(', ') + '). ' +
        '제출 데이터에 고득점자가 많아 실제 등급컷과 차이가 있을 수 있습니다.' +
        '</td></tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // --- 종합 분석 (축약: 2줄 이내, 시뮬레이션 기반) ---
  function renderInterpretation(grouped, avgData, simResults) {
    var container = document.getElementById("interpretation");
    container.innerHTML = "";
  }

  // --- 히스토그램 ---
  function renderHistogramTabs(grouped) {
    var tabsContainer = document.getElementById("hist-tabs");
    var subjects = Object.keys(grouped);
    tabsContainer.innerHTML = "";

    subjects.forEach(function (subj, i) {
      var btn = document.createElement("button");
      btn.className = "try-tab-btn" + (i === 0 ? " active" : "");
      btn.textContent = subj;
      btn.addEventListener("click", function () {
        tabsContainer.querySelectorAll(".try-tab-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderHistogram(subj, grouped[subj]);
      });
      tabsContainer.appendChild(btn);
    });

    if (subjects.length > 0) {
      renderHistogram(subjects[0], grouped[subjects[0]]);
    }
  }

  function renderHistogram(subject, scores) {
    var ctx = document.getElementById("hist-chart").getContext("2d");
    if (histChart) histChart.destroy();

    // 빈 계산
    var min = Math.floor(Math.min.apply(null, scores));
    var max = Math.ceil(Math.max.apply(null, scores));
    var binSize = Math.max(1, Math.round((max - min) / 20));
    var bins = [];
    var labels = [];

    for (var b = min; b <= max; b += binSize) {
      bins.push(0);
      labels.push(b);
    }

    scores.forEach(function (s) {
      var idx = Math.min(Math.floor((s - min) / binSize), bins.length - 1);
      if (idx >= 0) bins[idx]++;
    });

    // 등급컷 라인 위치
    var cutline = computePercentile(scores, 96);

    // 1등급컷 세로선 위치 (label 인덱스)
    var cutlineIdx = 0;
    for (var ci = 0; ci < labels.length; ci++) {
      if (labels[ci] >= cutline) { cutlineIdx = ci; break; }
      cutlineIdx = ci;
    }

    var datasets = [{
      label: "인원 수",
      data: bins,
      backgroundColor: "rgba(59, 130, 246, 0.4)",
      borderColor: "#3b82f6",
      borderWidth: 1,
      borderRadius: 2,
    }];

    // 1등급컷 세로선을 annotation 대신 별도 데이터셋으로
    var cutlineData = new Array(bins.length).fill(null);
    cutlineData[cutlineIdx] = Math.max.apply(null, bins) * 1.1;
    datasets.push({
      label: "1등급컷 (" + Math.round(cutline) + "점)",
      data: cutlineData,
      type: "bar",
      backgroundColor: "rgba(239, 68, 68, 0.7)",
      borderColor: "#ef4444",
      borderWidth: 0,
      barPercentage: 0.15,
      categoryPercentage: 1,
    });

    histChart = new Chart(ctx, {
      type: "bar",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) { return items[0].label + "점 구간"; },
              label: function (item) { return item.parsed.y + "명"; },
            },
          },
          annotation: undefined,
        },
        scales: {
          x: {
            title: { display: true, text: "원점수", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR, maxTicksLimit: 15 },
            grid: { color: CHART_GRID_COLOR },
          },
          y: {
            title: { display: true, text: "인원 수", color: CHART_TICK_COLOR },
            ticks: { color: CHART_TICK_COLOR },
            grid: { color: CHART_GRID_COLOR },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // --- 이미지 저장 ---
  function saveResultImage() {
    var area = document.getElementById("results-capture-area");
    if (!area) return;

    html2canvas(area, {
      backgroundColor: "#ffffff",
      scale: 2,
    }).then(function (canvas) {
      var link = document.createElement("a");
      link.download = "firstcut_analysis.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  }

  // --- 리셋 ---
  function resetUpload() {
    var uploadCard = document.getElementById("upload-card");
    if (uploadCard) {
      uploadCard.classList.remove("collapsed");
      uploadCard.style.display = "";
    }
    document.getElementById("analysis-results").style.display = "none";
    document.getElementById("validation-card").style.display = "none";
    var fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
    parsedData = null;
    if (histChart) { histChart.destroy(); histChart = null; }
    // 샘플 버튼 활성 상태 초기화
    document.querySelectorAll(".sample-btn").forEach(function (b) { b.classList.remove("active"); });
    // 업로드 영역 이벤트 재활성화
    var uploadZone = document.getElementById("upload-zone");
    if (uploadZone) uploadZone.style.pointerEvents = "";
  }

  // --- Boot ---
  document.addEventListener("DOMContentLoaded", function () {
    init().then(function () {
      setupSampleButtons();
      // 기본값: 1000명 예시 데이터 자동 로딩
      runSampleAnalysis(1000);
      // 1000명 버튼 active 표시
      document.querySelectorAll(".sample-btn").forEach(function (b) {
        if (b.dataset.n === "1000") b.classList.add("active");
      });
      // 업로드 관련은 마지막에 (file chooser 트리거 방지)
      setupTryIt();
    });
  });
})();
