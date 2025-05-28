import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
Chart.register(ChartDataLabels);
Chart.register(...registerables);


type TornadoRow = {
  label: string;
  deltaAbsMinus: number;    // ΔQ (base -> min)
  deltaAbsPlus: number;     // ΔQ (base -> max)
  deltaPercentMinus: number;
  deltaPercentPlus: number;
  minValue: number;
  maxValue: number;
  qBase: number;
  qMin: number;
  qMax: number;
  absMax: number;           // максимальное по модулю (для сортировки)
};

@Component({
  selector: 'app-compare-debit',
  templateUrl: './compare-debit.component.html',
  styleUrls: ['./compare-debit.component.scss']
})
export class CompareDebitComponent implements OnInit {
  @ViewChild('chartTornado') chartTornadoCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTornadoModal') chartTornadoModalCanvas?: ElementRef<HTMLCanvasElement>;

  public result: string[] = [];
  public form: FormGroup;
  public enlargedTornado = false;

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
  get chartHeight(): number {
    const count = this.tornadoData.labels?.length ?? 0;
    return Math.max(150, 60 * count);
  }


  public variableOptions = this.options.map(field => ({ name: field.name, label: field.label }));

  public tornadoData: ChartData<'bar'> = { labels: [], datasets: [] };
  public tornadoOptions: ChartOptions<'bar'> = {};

  private tornadoChart: Chart<'bar'> | null = null;
  private tornadoChartModal: Chart<'bar'> | null = null;

  constructor(private fb: FormBuilder) {
    const group: any = {
      variables: [[], Validators.required],
      base_Rkv: ['', Validators.required],
      base_H: ['', Validators.required],
      base_Lh: ['', Validators.required],
      base_Rc: ['', Validators.required],
      base_Rkh: ['', Validators.required],
      base_v: ['', Validators.required],
      base_Ppl: ['', Validators.required],
      base_deltaP: ['', Validators.required],
      base_Av: ['', Validators.required],
      base_Bv: ['', Validators.required],
      Rkv: [''],
      H: [''],
      Lh: [''],
      Rc: [''],
      Rkh: [''],
      v: [''],
      Ppl: [''],
      deltaP: [''],
      Av: [''],
      Bv: ['']
    };
    this.form = this.fb.group(group);
  }

  ngOnInit(): void {
    this.form.get('variables')?.valueChanges.subscribe(() => this.applyValidators());
    this.applyValidators();
    this.initTornadoChart();
  }

  private applyValidators(): void {
    const variables = this.form.get('variables')?.value || [];
    this.fields.forEach(field => {
      const baseControl = this.form.get('base_' + field.name);
      if (baseControl) {
        baseControl.setValidators([Validators.required, this.positiveNumberOnly()]);
        baseControl.updateValueAndValidity();
      }
      const control = this.form.get(field.name);
      if (!control) return;
      if (variables.includes(field.name)) {
        control.setValidators([this.multiValueValidator()]);
      } else {
        control.setValidators(null);
        control.setValue('');
      }
      control.updateValueAndValidity();
    });
  }

  public onSubmit(): void {
    const symbols: { [key: string]: string } = {
      H: 'H', Lh: 'Lгс', Rc: 'Rc', Rkh: 'Rk', v: 'v'
    };
    const names: { [key: string]: string } = {
      H: 'толщина пласта', Lh: 'длина горизонтального ствола', Rc: 'радиус скважины',
      Rkh: 'расстояние до границы зоны дренирования', v: 'анизотропия'
    };

    if (this.form.valid) {
      this.result = [];
      const variables: string[] = this.form.value.variables;
      const inputs = this.form.value;
      const toNum = (val: any): number => parseFloat(String(val).replace(',', '.'));

      // 1. Сбор базовых параметров
      const baseParams: any = {};
      this.fields.forEach(field => {
        baseParams[field.name] = toNum(inputs['base_' + field.name]);
      });

      // 2. Считаем Q_base
      const Q_base = this.calcDebit(baseParams);

      // 3. Формируем tornadoRows и result[]
      let tornadoRows: TornadoRow[] = [];

      variables.forEach((variable, i) => {
        const variableLabel = this.fields.find(f => f.name === variable)?.label || variable;
        const unit = variableLabel.split(',')[1]?.trim() || '';
        const symbol = symbols[variable] || variable;
        const paramName = names[variable] || variableLabel.split(',')[0].toLowerCase();
        const baseValue = baseParams[variable];

        let values = (inputs[variable] || '')
          .split(';')
          .map((val: string) => toNum(val.trim()))
          .filter((num: number) => !isNaN(num) && num > 0);

        values = [baseValue, ...values];
        values = Array.from(new Set(values));
        // Сортируем для расчётов и текста
        values = values.sort((a: number, b : number) => a - b);

        const debits: number[] = [];
        values.forEach((value: number) => {
          const localParams = { ...baseParams, [variable]: value };
          debits.push(this.calcDebit(localParams));
        });

        // Текстовый вывод
        this.result.push(`${i + 1}) Расчеты по фактору: ${variableLabel}.`);
        values.forEach((value: number, idx: number) => {
          this.result.push(
            `   - При ${symbol} = ${value} ${unit}, Q = ${debits[idx].toFixed(2)} тыс.м³/сут.`
          );
        });


        if (values.length > 1) {
          const minV = values[0], maxV = values[values.length - 1];
          const minQ = debits[0], maxQ = debits[debits.length - 1];

          const trend = maxQ > minQ ? 'увеличился' : 'уменьшился';
          const deltaP = (((maxV - minV) / minV) * 100).toFixed(2);
          const ratioP = (maxV / minV).toFixed(2);

          let deltaQ: string, ratioQ: string;
          if (maxQ > minQ) {
            deltaQ = (((maxQ - minQ) / minQ) * 100).toFixed(2);
            ratioQ = (maxQ / minQ).toFixed(2);
          } else {
            deltaQ = (((minQ - maxQ) / minQ) * 100).toFixed(2);
            ratioQ = (minQ / maxQ).toFixed(2);
          }

          this.result.push(
            `   При увеличении фактора ${paramName} с ${minV} ${unit} до ${maxV} ${unit} (примерно на ${deltaP}% / в ${ratioP} раз), дебит ${trend} с ${minQ.toFixed(2)} тыс.м³/сут до ${maxQ.toFixed(2)} тыс.м³/сут (примерно на ${deltaQ}% / в ${ratioQ} раз).`
          );
        }
        const qMin = Math.min(...debits);
        const qMax = Math.max(...debits);
        const minValue = values[debits.indexOf(qMin)];
        const maxValue = values[debits.indexOf(qMax)];
        // Для торнадо: используем именно min и max значения (без base)
        const deltaAbsMinus = qMin - Q_base;
        const deltaAbsPlus = qMax - Q_base;
        const deltaPercentMinus = Q_base !== 0 ? (deltaAbsMinus / Q_base) * 100 : 0;
        const deltaPercentPlus = Q_base !== 0 ? (deltaAbsPlus / Q_base) * 100 : 0;
        const absMax = Math.max(Math.abs(deltaAbsMinus), Math.abs(deltaAbsPlus)); // для сортировки

        tornadoRows.push({
          label: variableLabel.split(',')[0],
          deltaAbsMinus,
          deltaAbsPlus,
          deltaPercentMinus: Q_base ? (deltaAbsMinus / Q_base) * 100 : 0,
          deltaPercentPlus: Q_base ? (deltaAbsPlus / Q_base) * 100 : 0,
          minValue,
          maxValue,
          qBase: Q_base,
          qMin,
          qMax,
          absMax: Math.max(Math.abs(deltaAbsMinus), Math.abs(deltaAbsPlus))
        });
      });

      // 5. Сортировка по максимальному влиянию (по модулю)
      tornadoRows = tornadoRows.sort((a, b) => b.absMax - a.absMax);
      this._lastTornadoRows = tornadoRows;

      // 6. Обновить данные графика (двусторонний)
      this.updateTornadoData(tornadoRows);

      setTimeout(() => this.renderTornadoChart(), 0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  public tornadoDisplayMode: 'absolute' | 'percent' = 'absolute';
  public switchTornadoDisplayMode(mode: 'absolute' | 'percent') {
    this.tornadoDisplayMode = mode;
    this.updateTornadoData(this._lastTornadoRows);
    setTimeout(() => this.renderTornadoChart(), 0);
    if (this.enlargedTornado) setTimeout(() => this.renderTornadoChartModal(), 0);
  }

  private _lastTornadoRows: TornadoRow[] = [];

  private updateTornadoData(rows: TornadoRow[]) {
    const labels = rows.map(r => r.label);
    const barThickness = 25;
    const barPercentage = 0.7;
    const categoryPercentage = 0.6;

    // --- Новый datalabels ---
    const alignHandler = (ctx: any) => {
      const value = ctx.dataset.data[ctx.dataIndex];
      if (Math.abs(value) < 15) {
        return value > 0 ? 'right' : 'left';
      }
      return 'center';
    };

    const anchorHandler = (ctx: any) => {
      const value = ctx.dataset.data[ctx.dataIndex];
      if (Math.abs(value) < 15) {
        return value > 0 ? 'end' : 'start';
      }
      return 'center';
    };

    const formatValue = (v: number) => {
      if (Math.abs(v) < 1) return (v > 0 ? '+' : '') + v.toFixed(2);
      if (Math.abs(v) < 10) return (v > 0 ? '+' : '') + v.toFixed(2);
      if (Math.abs(v) < 100) return (v > 0 ? '+' : '') + v.toFixed(1);
      return (v > 0 ? '+' : '') + v.toFixed(0);
    };

    if (this.tornadoDisplayMode === 'absolute') {
      this.tornadoData = {
        labels,
        datasets: [
          {
            label: 'ΔQ (мин → исходное)',
            data: rows.map(r => r.deltaAbsMinus),
            backgroundColor: '#f44336',
            stack: 'Q',
            borderRadius: 4,
            barThickness,
            barPercentage,
            categoryPercentage,
          },
          {
            label: 'ΔQ (исходное → макс)',
            data: rows.map(r => r.deltaAbsPlus),
            backgroundColor: '#1976d2',
            stack: 'Q',
            borderRadius: 4,
            barThickness,
            barPercentage,
            categoryPercentage,
          }
        ]
      };
      this.tornadoOptions = {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.x;
                return `${ctx.dataset.label}: ${v > 0 ? '+' : ''}${v.toFixed(2)} тыс.м³/сут`;
              }
            }
          },
          datalabels: {
            display: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              // Лейблы не показываются если оба маленькие - реализуй это по желанию!
              return Math.abs(value) > 0.3;
            },
            anchor: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              if (Math.abs(value) < 50) return value > 0 ? 'end' : 'start';
              return 'center';
            },
            align: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              if (Math.abs(value) < 50) return value > 0 ? 'right' : 'left';
              return 'center';
            },
            offset: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              if (Math.abs(value) < 50) return value > 0 ? 10 : -1;
              return 0;
            },
            color: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              return Math.abs(value) < 50 ? '#222' : '#222';
            },
            font: {
              weight: 'bold',
              size: 14,
            },
            formatter: (value: any) => {
              value = Number(value);
              if (Math.abs(value) < 0.1) return '';
              if (Math.abs(value) < 1) return value.toFixed(2);
              if (Math.abs(value) < 10) return value.toFixed(1);
              return value.toFixed(0);
            },
            clamp: true,
          },

        },
        scales: {
          x: {
            stacked: true,
            title: { display: true, text: 'ΔQ, тыс.м³/сут' },
            grid: { display: true, drawBorder: true } as any,
            beginAtZero: true,
            min: undefined,
            max: undefined,
          },
          y: {
            stacked: true,
            title: { display: true, text: 'Фактор' },
            grid: { display: true, drawBorder: true } as any,
          }
        }
      };
    } else {
      this.tornadoData = {
        labels,
        datasets: [
          {
            label: 'ΔQ (%) (мин → исходное)',
            data: rows.map(r => r.deltaPercentMinus),
            backgroundColor: '#f44336',
            stack: 'Q',
            borderRadius: 4,
            barThickness: 18,
          },
          {
            label: 'ΔQ (%) (исходное → макс)',
            data: rows.map(r => r.deltaPercentPlus),
            backgroundColor: '#1976d2',
            stack: 'Q',
            borderRadius: 4,
            barThickness: 18,
          }
        ]
      };
      this.tornadoOptions = {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.x;
                return `${ctx.dataset.label}: ${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
              }
            }
          },
          datalabels: {
            display: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              // Лейблы не показываются если оба маленькие - реализуй это по желанию!
              return Math.abs(value) > 0.3;
            },
            anchor: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              if (Math.abs(value) < 25) return value > 0 ? 'end' : 'start';
              return 'center';
            },
            align: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              if (Math.abs(value) < 25) return value > 0 ? 'right' : 'left';
              return 'center';
            },
            offset: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              if (Math.abs(value) < 25) return value > 0 ? 10 : -1; //процент
              return 0;
            },
            color: (ctx: any) => {
              const value = Number(ctx.dataset.data[ctx.dataIndex]);
              return Math.abs(value) < 25 ? '#222' : '#222';
            },
            font: {
              weight: 'bold',
              size: 14,
            },
            formatter: (value: any) => {
              value = Number(value);
              if (Math.abs(value) < 0.1) return '';
              if (Math.abs(value) < 1) return value.toFixed(2);
              if (Math.abs(value) < 10) return value.toFixed(1);
              return value.toFixed(0);
            },
            clamp: true,
          },
        },
        scales: {
          x: {
            stacked: true,
            title: { display: true, text: 'ΔQ, %' },
            grid: { display: true, drawBorder: true } as any,
            beginAtZero: true,
            min: undefined,
            max: undefined,
          },
          y: {
            stacked: true,
            title: { display: true, text: 'Фактор' },
            grid: { display: true, drawBorder: true } as any,
          }
        }
      };
    }
  }




  private initTornadoChart(): void {
    this.tornadoData = { labels: [], datasets: [] };
    this.tornadoOptions = {
      indexAxis: 'y',
      responsive: true
    };
  }

  public downloadTornadoChart(): void {
    const canvas = this.enlargedTornado && this.chartTornadoModalCanvas?.nativeElement
      ? this.chartTornadoModalCanvas.nativeElement
      : this.chartTornadoCanvas?.nativeElement;
    if (canvas) {
      const base64 = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = base64;
      a.download = 'tornado_sensitivity.png';
      a.click();
    }
  }

  private renderTornadoChart(): void {
    if (this.tornadoChart) {
      this.tornadoChart.destroy();
      this.tornadoChart = null;
    }
    if (this.chartTornadoCanvas?.nativeElement) {
      this.tornadoChart = new Chart(this.chartTornadoCanvas.nativeElement, {
        type: 'bar',
        data: this.tornadoData,
        options: this.tornadoOptions,

      });
    }
  }

  private renderTornadoChartModal(): void {
    if (this.tornadoChartModal) {
      this.tornadoChartModal.destroy();
      this.tornadoChartModal = null;
    }
    if (this.chartTornadoModalCanvas?.nativeElement) {
      this.tornadoChartModal = new Chart(this.chartTornadoModalCanvas.nativeElement, {
        type: 'bar',
        data: this.tornadoData,
        options: {
          ...this.tornadoOptions,
          responsive: false,
          maintainAspectRatio: false,

        }
      });
    }
  }

  public toggleEnlargeTornadoChart(): void {
    this.enlargedTornado = !this.enlargedTornado;
    if (this.enlargedTornado) {
      setTimeout(() => this.renderTornadoChartModal(), 50);
    } else {
      if (this.tornadoChartModal) {
        this.tornadoChartModal.destroy();
        this.tornadoChartModal = null;
      }
    }
  }

  public async copyResult(): Promise<void> {
    if (this.result.length > 0) {
      try {
        await navigator.clipboard.writeText(this.result.join('\n'));
      } catch (err) {
        console.error('Ошибка при копировании:', err);
      }
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
      if (typeof control.value !== 'string') return { onlyPositive: true };
      const parts = control.value.split(';').map((p: string) => p.trim().replace(',', '.'));
      const allValid = parts.every((p: string) => /^\d*\.?\d+$/.test(p) && parseFloat(p) > 0);
      return allValid ? null : { onlyPositive: true };
    };
  }
  private originalResult: string[] | null = null;
  public replaceDotsWithCommas(): void {
    if (!this.originalResult) {
      this.originalResult = [...this.result];
      this.result = this.result.map(line => line.replace(/(\d+)\.(\d+)/g, '$1,$2'));
    } else {
      this.result = [...this.originalResult];
      this.originalResult = null;
    }
  }

  private calcDebit(inputs: any): number {
    const toNum = (val: any) => parseFloat(String(val).replace(',', '.'));
    const _Rkv = toNum(inputs.Rkv);
    const _H = toNum(inputs.H);
    const _Lh = toNum(inputs.Lh);
    const _Rc = toNum(inputs.Rc);
    const _Rkh = toNum(inputs.Rkh);
    const _v = toNum(inputs.v);
    const _Ppl = toNum(inputs.Ppl);
    const _deltaP = toNum(inputs.deltaP);
    const _Av = toNum(inputs.Av);
    const _Bv = toNum(inputs.Bv);

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
    return Number(debit) || 0;
  }
}
