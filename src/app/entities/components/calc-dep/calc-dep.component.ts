import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
  ValidationErrors
} from '@angular/forms';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-calc-dep',
  templateUrl: './calc-dep.component.html',
  styleUrls: ['./calc-dep.component.scss']
})
export class CalcDepComponent implements OnInit {
  public result: string[] = [];
  public form: FormGroup;

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

  public options  = [
    { name: 'H', label: 'Толщина пласта, м' },
    { name: 'Lh', label: 'Длина горизонтального ствола, м' },
    { name: 'Rc', label: 'Радиус скважины, м' },
    { name: 'Rkh', label: 'Расстояние до границы зоны дренирования, м' },
    { name: 'v', label: 'Анизотропия, д.ед' },
  ];

  public variableOptions = this.options.map(field => ({ name: field.name, label: field.label }));

  public chartLabels: string[] = [];
  public chartData: number[] = [];
  public chartConfig: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: this.chartLabels,
      datasets: [{ data: this.chartData, label: 'Дебит', fill: true, tension: 0.4 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
        x: {},
        y: { beginAtZero: true }
      }
    }
  };

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
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
    this.form.get('variable')?.valueChanges.subscribe(() => {
      this.applyValidators();
    });
    this.applyValidators();
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

  public onSubmit(): void {
    if (this.form.valid) {
      const variable = this.form.get('variable')?.value;
      const inputs = this.form.value;

      const values = inputs[variable]
        .split(';')
        .map((val: string) => parseFloat(val.trim()))
        .filter((num: number) => !isNaN(num) && num > 0);

      this.result = [];
      this.chartLabels = [];
      this.chartData = [];

      values.forEach((value: number) => {
        const localInputs = { ...inputs, [variable]: value };

        const h1 = localInputs.H / 2 - localInputs.Rc;
        const A = localInputs.Av * Math.PI * h1 / Math.log(localInputs.Rkv / localInputs.Rc);
        const B = 2 * localInputs.Bv * (Math.PI * h1) ** 2 / (1 / localInputs.Rc - 1 / localInputs.Rkv);
        const Ah = A / (2 * localInputs.Lh) * (2 / (h1 * localInputs.v) * (h1 * localInputs.v + localInputs.Rc * Math.log(localInputs.Rc / (localInputs.Rc + h1 * localInputs.v))))
          + (localInputs.Rkh - localInputs.v * h1) / (localInputs.Rc + localInputs.v * h1);
        const Bh = B / (8 * localInputs.Lh ** 2) * (2 / (localInputs.v * h1) * (
          Math.log((localInputs.Rc + localInputs.v * h1) / localInputs.Rc)
          - localInputs.v * h1 / (localInputs.Rc + localInputs.v * h1)
          + (localInputs.Rkh - localInputs.v * h1) / ((localInputs.Rc + localInputs.v * h1) ** 2)
        ));
        const debit = ((-Ah + Math.sqrt(Ah ** 2 + 4 * Bh * (localInputs.Ppl ** 2 - (localInputs.Ppl - localInputs.deltaP) ** 2))) / (2 * Bh));

        this.result.push(`${variable} = ${value} → дебит = ${debit.toFixed(6)} тыс.м³/сут`);
        this.chartLabels.push(value.toString());
        this.chartData.push(Number(debit.toFixed(6)));
      });

      this.chartConfig.data = {
        labels: this.chartLabels,
        datasets: [{ data: this.chartData, label: 'Дебит', fill: true, tension: 0.4 }]
      };
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
      const value = control.value;
      const isValid = /^\d*\.?\d+$/.test(value) && parseFloat(value) > 0;
      return isValid ? null : { onlyPositive: true };
    };
  }

  private multiValueValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parts = control.value.split(';').map((p: string) => p.trim());
      const allValid = parts.every((p: string) => /^\d*\.?\d+$/.test(p) && parseFloat(p) > 0);
      return allValid ? null : { onlyPositive: true };
    };
  }
}
