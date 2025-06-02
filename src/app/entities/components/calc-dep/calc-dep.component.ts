import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
  ValidationErrors
} from '@angular/forms';
import { ChartConfiguration, ChartDataset } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

function getColor(index: number): string {
  const colors = ['orange', '#43a047', '#3949ab', '#f44336', '#6d4c41', '#00838f', '#e65100', '#c51162'];
  return colors[index % colors.length];
}

type Curve = {
  label: string;
  color: string;
  variableName: string;
  variableLabel: string;
  data: { x: number, y: number }[];
  results: string[];
  resultsRaw: string[]; 
};

@Component({
  selector: 'app-calc-dep',
  templateUrl: './calc-dep.component.html',
  styleUrls: ['./calc-dep.component.scss']
})
export class CalcDepComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  public form: FormGroup;
  public enlarged = false;

  public allResults: Curve[] = [];
  private showCommas = false; 

  get canAddCalculation(): boolean {
    if (this.allResults.length === 0) return false;
    const variable = this.form.get('variable')?.value;
    return this.allResults.every(c => c.variableName === variable);
  }

  private addMode = false;
  get hasResults(): boolean {
    return this.allResults.length > 0;
  }


  public fields = [
    { name: 'Rkv', label: 'Радиус контура питания вертикальной скважины, м' },
    { name: 'H', label: 'Толщина пласта, м' },
    { name: 'Lh', label: 'Длина горизонтального ствола, м' },
    { name: 'Rc', label: 'Радиус скважины, м' },
    { name: 'Rkh', label: 'Расстояние до границы зоны дренирования, м' },
    { name: 'v', label: 'Анизотропия, д.ед' },
    { name: 'Ppl', label: 'Пластовое давление, МПа' },
    { name: 'deltaP', label: 'Депрессия на пласт, МПа' },
    { name: 'Av', label: 'Аверт, МПа²·сут/тыс.м³' },
    { name: 'Bv', label: 'Вверт, (МПа²·сут/тыс.м³)²' }
  ];

  public options = [
    { name: 'H', label: 'Толщина пласта, м' },
    { name: 'Lh', label: 'Длина горизонтального ствола, м' },
    { name: 'Rc', label: 'Радиус скважины, м' },
    { name: 'Rkh', label: 'Расстояние до границы зоны дренирования, м' },
    { name: 'v', label: 'Анизотропия, д.ед' }
  ];
  public variableOptions = this.options.map(field => ({ name: field.name, label: field.label }));

  public chartConfig: ChartConfiguration<'line'> = {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true,
      elements: { line: { tension: 0 } },
      plugins: {
        legend: { display: true },
        tooltip: {
          mode: 'nearest',
          intersect: false,
          callbacks: {
            title: ctx => {
              const datasetIndex = ctx[0]?.datasetIndex ?? 0;
              const curve = this.allResults[datasetIndex];
              return curve ? `${curve.variableLabel}: ${ctx[0].parsed.x}` : '';
            },
            label: ctx => `Дебит: ${ctx.parsed.y} тыс.м³/сут`
          }
        },
        datalabels: {
          display: false
        },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: { align: 'start' },
          title: { display: true, text: '' }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Дебит, тыс.м³/сут' }
        }
      }
    }
  };

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      customLabel: [''],
      variable: ['Lh', Validators.required],
      Rkv: ['', Validators.required],
      H: ['', Validators.required],
      Lh: ['', Validators.required],
      Rc: ['', Validators.required],
      Rkh: ['', Validators.required],
      v: ['', Validators.required],
      Ppl: ['', Validators.required],
      deltaP: ['', Validators.required],
      Av: ['', Validators.required],
      Bv: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.form.get('variable')?.valueChanges.subscribe(() => this.applyValidators());
    this.applyValidators();
    this.form.get('variable')?.valueChanges.subscribe(() => {
      this.applyValidators();
      this.updateChart(); 

    });

  }

  private applyValidators(): void {
    const variable = this.form.get('variable')?.value;
    this.fields.forEach(field => {
      const control = this.form.get(field.name);
      if (!control) return;
      if (field.name === variable) {
        control.setValidators([Validators.required, this.multiValueValidator()]);
      } else {
        control.setValidators([Validators.required, this.positiveNumberOnly()]);
      }
      control.updateValueAndValidity();
    });
  }

  
  public onCalculate(): void {
    this.allResults = [];
    this.addMode = false;
    this.showCommas = false;
    this.addCalculation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  public onAddCalculation(): void {
    this.addMode = true;
    this.addCalculation();
  }


  private addCalculation(): void {
    if (this.form.valid) {
      const variable = this.form.get('variable')?.value;
      const variableLabel = this.fields.find(f => f.name === variable)?.label || variable;
      const unit = variableLabel.split(',')[1]?.trim() || '';
      const inputs = this.form.value;
      const toNum = (val: any): number => parseFloat(String(val).replace(',', '.'));

      const values = inputs[variable]
        .split(';')
        .map((val: string) => toNum(val.trim()))
        .filter((num: number) => !isNaN(num) && num > 0)
        .sort((a: number, b: number) => a - b);

      const userLabel = (inputs.customLabel || '').trim();
      const resultNumber = this.allResults.length + 1;
      const curveLabel = userLabel ? userLabel : `Расчёт ${resultNumber}`;

      const label = userLabel
        ? userLabel
        : `${curveLabel}`;
      const chartData: { x: number, y: number }[] = [];
      const results: string[] = [];
      const resultsRaw: string[] = [];

      values.forEach((value: number, index: number) => {
        const localInputs = { ...inputs, [variable]: value };
        const _Rkv = toNum(localInputs.Rkv);
        const _H = toNum(localInputs.H);
        const _Lh = toNum(localInputs.Lh);
        const _Rc = toNum(localInputs.Rc);
        const _Rkh = toNum(localInputs.Rkh);
        const _v = toNum(localInputs.v);
        const _Ppl = toNum(localInputs.Ppl);
        const _deltaP = toNum(localInputs.deltaP);
        const _Av = toNum(localInputs.Av);
        const _Bv = toNum(localInputs.Bv);

        const h1 = _H / 2 - _Rc;
        const A = _Av * Math.PI * h1 / Math.log(_Rkv / _Rc);
        const B = 2 * _Bv * Math.pow(Math.PI * h1, 2) / (1 / _Rc - 1 / _Rkv);

        const Ah = (A / (2 * _Lh)) * (
          (2 / (_v * h1)) * (_v * h1 + _Rc * Math.log(_Rc / (_Rc + _v * h1))) +
          (_Rkh - _v * h1) / (_Rc + _v * h1)
        );

        const Bh = B / (8 * _Lh ** 2) * (
          (2 / (_v * h1)) * (
            Math.log((_Rc + _v * h1) / _Rc) -
            (_v * h1) / (_Rc + _v * h1)
          ) +
          (_Rkh - _v * h1) / Math.pow((_Rc + _v * h1), 2)
        );

        const discriminant = Ah ** 2 + 4 * Bh * (_Ppl ** 2 - (_Ppl - _deltaP) ** 2);
        let debit = NaN;
        if (discriminant >= 0) {
          debit = ((-Ah + Math.sqrt(discriminant)) / (2 * Bh))*2;
        }
 
        const out =
          `\n${index + 1}) ${variableLabel.split(',')[0]}: ${value} ${unit},\n` +
          `h₁ = ${h1.toFixed(3)} м,\n` +
          `A* = ${A.toFixed(7)} МПа²·сут·м/тыс.м³,\n` +
          `B* = ${B.toFixed(7)} МПа²·сут/тыс.м³)²·м³,\n` +
          `Aг₁=Аг₂= ${Ah.toFixed(7)} МПа²·сут/тыс.м³,\n` +
          `Вг₁=Вг₂= ${Bh.toExponential(2)} (МПа²·сут/тыс.м³)²,\n` +
          `Дебит: ${debit.toFixed(2)} тыс.м³/сут`;
        resultsRaw.push(out);
        chartData.push({ x: value, y: Number(debit.toFixed(2)) });
      });


      if (chartData.length > 1) {
        const xMin = chartData[0].x;
        const xMax = chartData[chartData.length - 1].x;
        const yMin = chartData[0].y;
        const yMax = chartData[chartData.length - 1].y;
        const xDelta = ((xMax - xMin) / xMin * 100).toFixed(2);
        const xRatio = (xMax / xMin).toFixed(2);
        const yDeltaAbs = Math.abs(((yMax - yMin) / yMin * 100)).toFixed(2);
        const yRatioAbs = (yMax > yMin ? (yMax / yMin) : (yMin / yMax)).toFixed(2);
        const trend = yMax > yMin ? 'увеличился' : 'уменьшился';

        const summary =
          `\nПри увеличении фактора ${variableLabel.split(',')[0].toLowerCase()} с ${xMin} ${unit} до ${xMax} ${unit} ` +
          `(примерно на ${xDelta}% / в ${xRatio} раз), дебит горизонтальной газовой скважины ${trend} ` +
          `с ${yMin} тыс.м³/сут до ${yMax} тыс.м³/сут (примерно на ${yDeltaAbs}% / в ${yRatioAbs} раз).`;
        resultsRaw.push(summary);
      }


      let resultsDisplay = resultsRaw.map(line =>
        this.showCommas ? line.replace(/(\d+)\.(\d+)/g, '$1,$2') : line
      );

      const color = getColor(this.allResults.length);
      this.allResults.push({
        label,
        color,
        variableName: variable,
        variableLabel,
        data: chartData,
        results: resultsDisplay,
        resultsRaw: [...resultsRaw]
      });

      this.updateChart();
    }
  }

  updateChart(): void {
    this.chartConfig.data.datasets = this.allResults.map((curve, idx) => ({
      data: curve.data,
      label: curve.label,
      borderColor: curve.color,
      backgroundColor: 'transparent',
      pointBackgroundColor: curve.color,
      pointBorderColor: curve.color,
      tension: 0
    })) as ChartDataset<'line'>[];


    let variableLabel = '';
    if (this.allResults.length) {
      const lastCurve = this.allResults[this.allResults.length - 1];
      variableLabel = lastCurve.variableLabel;
    } else {
      const variable = this.form.get('variable')?.value;
      const field = this.fields.find(f => f.name === variable);
      variableLabel = field?.label ?? '';
    }


    this.chartConfig.options = {
      ...this.chartConfig.options,
      scales: {
        ...this.chartConfig.options?.scales,
        x: {
          ...(this.chartConfig.options?.scales?.['x'] as any),
          title: {
            ...(this.chartConfig.options?.scales?.['x']?.title ?? {}),
            text: variableLabel
          }
        },
        y: {
          ...(this.chartConfig.options?.scales?.['y'] as any)
        }
      }
    };

    this.chart?.update();
  }



  clearAll(): void {
    this.allResults = [];
    this.showCommas = false;
    this.updateChart();
  }

  public async copyAllResults(withComma: boolean = this.showCommas): Promise<void> {
    const formatResults = (line: string) =>
      withComma ? line.replace(/(\d+)\.(\d+)/g, '$1,$2') : line;

    const all = this.allResults.map((s) =>
      `${s.label}:\n${s.resultsRaw.map(formatResults).join('\n')}`
    ).join('\n\n');
    try {
      await navigator.clipboard.writeText(all);
    } catch (err) {
      console.error('Ошибка при копировании:', err);
    }
  }


  public downloadChart(): void {
    const base64 = this.chart?.chart?.toBase64Image('image/png', 1);
    if (base64) {
      const a = document.createElement('a');
      a.href = base64;
      a.download = 'chart.png';
      a.click();
    }
  }

  public toggleEnlargeChart(): void {
    this.enlarged = !this.enlarged;
    if (this.enlarged) {
      setTimeout(() => this.chart?.update(), 100);
    }
  }

  private positiveNumberOnly(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (typeof control.value !== 'string') return { onlyPositive: true };
      const normalized = control.value.replace(',', '.');
      const isValid = /^\d*\.?\d+$/.test(normalized) && parseFloat(normalized) > 0;
      return isValid ? null : { onlyPositive: true };
    };
  }

  private multiValueValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parts = control.value.split(';').map((p: string) => p.trim().replace(',', '.'));
      const allValid = parts.every((p: string) => /^\d*\.?\d+$/.test(p) && parseFloat(p) > 0);
      return allValid ? null : { onlyPositive: true };
    };
  }

  public replaceDotsWithCommas(): void {
    this.showCommas = !this.showCommas;
    this.allResults.forEach(curve => {
      curve.results = curve.resultsRaw.map(line =>
        this.showCommas ? line.replace(/(\d+)\.(\d+)/g, '$1,$2') : line
      );
    });
  }
}
