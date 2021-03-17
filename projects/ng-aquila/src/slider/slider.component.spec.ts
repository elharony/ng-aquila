import { DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { Component, DebugElement, Type, ViewChild, ChangeDetectionStrategy, Directive } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import * as axe from 'axe-core';

import { NxSliderComponent } from './slider.component';
import { NxSliderModule } from './slider.module';

// For better readablity here, We can safely ignore some conventions in our specs
// tslint:disable:component-class-suffix

const createKeyboardEvent = (keyCode: number) => {
  const event = document.createEvent('KeyboardEvent') as any;
  Object.defineProperties(event, {
    keyCode: { get: () => keyCode },
    which: { get: () => keyCode },
  });
  return event;
};

@Directive()
abstract class SliderTest {
  @ViewChild(NxSliderComponent) sliderInstance: NxSliderComponent;
  stepSize: number = 1;
  min: number = 0;
  max: number = 10;
  value: number = 0;
  width: number = 100;
  thumbLabel: boolean = false;
  minMaxLabels: boolean = false;
}

declare type Coordinates = {
  x: number,
  y: number
};

describe('NxSliderComponent', () => {
  let fixture: ComponentFixture<SliderTest>;
  let testInstance: SliderTest;
  let sliderInstance: NxSliderComponent;
  let sliderDebugElement: DebugElement;
  let sliderNativeElement: HTMLElement;

  const createTestComponent = (component: Type<SliderTest>) => {
    fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    testInstance = fixture.componentInstance;
    sliderInstance = testInstance.sliderInstance;
    sliderDebugElement = fixture.debugElement.query(By.directive(NxSliderComponent));
    sliderNativeElement = sliderDebugElement.nativeElement;
  };

  beforeEach(waitForAsync((() => {
    TestBed.configureTestingModule({
      imports: [
        NxSliderModule,
        FormsModule,
        ReactiveFormsModule
      ],
      declarations: [
        BasicSlider,
        ConfigurableSlider,
        InvertedSlider,
        DisabledSlider,
        NegativeSlider,
        FloatSlider,
        TruncateTestSlider,
        SimpleBindingSlider,
        NgModelSlider,
        ReactiveFormsSlider,
        BasicSliderOnPush
      ]
    }).compileComponents();
  })));

  /**
   * Helper function to fake a slide event
   * Creates all relevant mouse events and dispatches them
   */
  const dispatchSlideEvent = (start: Coordinates, finish: Coordinates) => {
    const event = new MouseEvent('mousedown', {
      screenX: start.x,
      clientX: start.x,
      screenY: start.y,
      clientY: start.y
    });
    sliderInstance.dragStart(event);
    const dragEvent = new MouseEvent('mousemove', {
      screenX: finish.x,
      clientX: finish.x,
      screenY: finish.y,
      clientY: finish.y
    });
    const releaseEvent = new MouseEvent('mouseup', {
      screenX: finish.x,
      clientX: finish.x,
      screenY: finish.y,
      clientY: finish.y
    });
    document.dispatchEvent(dragEvent);
    document.dispatchEvent(releaseEvent);
  };

  function getFillerWidth() {
    const filler = fixture.nativeElement.querySelector('.nx-slider__filler');
    return filler.style.width;
  }

  describe('basic', () => {

    it('creates the Slider', () => {
      createTestComponent(BasicSlider);
      expect(sliderInstance).toBeTruthy();
      expect(sliderNativeElement.hasAttribute('aria-disabled')).toBe(false);
    });

    it('renders the Slider with a label', () => {
      createTestComponent(BasicSlider);
      const labelElement: HTMLLabelElement = sliderNativeElement.querySelector('label');
      const anchorElement: HTMLElement = sliderNativeElement.querySelector('.nx-slider__handle');
      expect(labelElement).not.toBeNull();
      expect(labelElement.textContent.trim()).toBe('testLabel');
      expect(labelElement.id).toBe('testSlider-label');
      expect(anchorElement.id).toBe('testSlider-handle');
    });

    it('renders the Slider with a thumb label', () => {
      createTestComponent(BasicSlider);
      const thumbLabel = fixture.nativeElement.querySelector('.nx-slider__value');
      expect(testInstance.sliderInstance.thumbLabel).toBe(true);
      expect(thumbLabel).not.toBeNull();
    });

    it('renders the Slider with min & max labels', () => {
      createTestComponent(BasicSlider);
      const minMaxLabels = fixture.nativeElement.querySelector('.nx-slider__label-container');
      expect(testInstance.sliderInstance.minMaxLabels).toBe(true);
      expect(minMaxLabels).not.toBeNull();
    });

    it('should set the default values', () => {
      createTestComponent(BasicSlider);
      expect(sliderInstance.value).toBe(0);
      expect(sliderInstance.min).toBe(0);
      expect(sliderInstance.max).toBe(100);
    });

    it('should correctly calculate percentages', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.min = 10;
      testInstance.max = 110;
      testInstance.value = 60;
      fixture.detectChanges();
      expect(sliderInstance.percentageValue).toBe(50);
    });

    it('should clamp the percentage', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.value = 1000;
      fixture.detectChanges();
      expect(sliderInstance.percentageValue).toBe(100);
      testInstance.value = -1000;
      fixture.detectChanges();
      expect(sliderInstance.percentageValue).toBe(0);
    });

    it('should correctly set the value on click', () => {
      createTestComponent(BasicSlider);
      const event = new MouseEvent('MouseEvent', {
        screenX: 20,
        clientX: 20,
        screenY: 10,
        clientY: 10
      });
      sliderInstance.sliderClick(event);
      sliderInstance.valueByPosition();

      const value = sliderInstance.value;
      expect(value).toBe(20);
      expect(sliderInstance.percentageValue).toBe(20);
    });

    it('should stay within range', () => {
      createTestComponent(BasicSlider);

      expect(sliderInstance.value).toBe(0);

      const leftArrowEvent = createKeyboardEvent(LEFT_ARROW);
      sliderInstance.handleKeypress(leftArrowEvent);
      expect(sliderInstance.value).toBe(0);

      sliderInstance.value = 100;

      const rightArrowEvent = createKeyboardEvent(RIGHT_ARROW);
      sliderInstance.handleKeypress(rightArrowEvent);
      expect(sliderInstance.value).toBe(100);
    });

    it('calculates valid steps correctly', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.min = 1;
      // minimum is valid step
      testInstance.value = 1;
      fixture.detectChanges();
      expect(sliderInstance.isValidStep()).toBe(true);
      // all multitudes are valid
      testInstance.value = 3;
      fixture.detectChanges();
      expect(sliderInstance.isValidStep()).toBe(true);
      testInstance.value = 2.5;
      fixture.detectChanges();
      expect(sliderInstance.isValidStep()).toBe(false);
      testInstance.stepSize = 0.28;
      testInstance.value = 1.28;
      fixture.detectChanges();
      expect(sliderInstance.isValidStep()).toBe(true);
      testInstance.value = 2.12;
      fixture.detectChanges();
      expect(sliderInstance.isValidStep()).toBe(true);
      testInstance.value = 1.5;
      fixture.detectChanges();
      expect(sliderInstance.isValidStep()).toBe(false);
    });

    it('should snap to the nearest valid step on click', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.min = 0;
      testInstance.stepSize = 10;
      testInstance.max = 100;
      testInstance.width = 1000;
      fixture.detectChanges();
      let event = new MouseEvent('MouseEvent', {
        screenX: 260,
        clientX: 260,
        screenY: 10,
        clientY: 10
      });
      sliderInstance.sliderClick(event);
      sliderInstance.valueByPosition();

      let value = sliderInstance.value;
      expect(value).toBe(30);
      expect(sliderInstance.percentageValue).toBe(30);

      event = new MouseEvent('MouseEvent', {
        screenX: 230,
        clientX: 230,
        screenY: 10,
        clientY: 10
      });
      sliderInstance.sliderClick(event);
      sliderInstance.valueByPosition();

      value = sliderInstance.value;
      expect(value).toBe(20);
      expect(sliderInstance.percentageValue).toBe(20);
    });

    it('should snap to the nearest valid step on keyboard event', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.min = 1;
      testInstance.max = 10;
      testInstance.value = 10;
      testInstance.stepSize = 0.28;
      fixture.detectChanges();

      const leftArrowEvent = createKeyboardEvent(LEFT_ARROW);
      sliderInstance.handleKeypress(leftArrowEvent);
      expect(sliderInstance.value).toBe(9.96);
    });

    it('should snap to the next valid step on slide', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.min = 0;
      testInstance.stepSize = 10;
      testInstance.max = 100;
      testInstance.width = 1000;
      fixture.detectChanges();

      dispatchSlideEvent({ x: 0, y: 10 }, { x: 260, y: 10 });
      sliderInstance.valueByPosition();

      expect(sliderInstance.value).toBe(30);
    });

    it('isMinimum is true when the value equals nxMin', () => {
      createTestComponent(ConfigurableSlider);
      testInstance.min = 2;
      testInstance.value = 2;
      fixture.detectChanges();
      expect(sliderInstance.isMinimum()).toBe(true);
      testInstance.value = 3;
      fixture.detectChanges();
      expect(sliderInstance.isMinimum()).toBe(false);
    });
  });

  describe('inverted', () => {

    it('should correctly set the value on click if inverted', () => {
      createTestComponent(InvertedSlider);
      const event = new MouseEvent('MouseEvent', {
        screenX: 20,
        clientX: 20,
        screenY: 10,
        clientY: 10
      });
      sliderInstance.sliderClick(event);
      sliderInstance.valueByPosition();

      const value = sliderInstance.value;
      expect(value).toBe(80);
      expect(sliderInstance.percentageValue).toBe(20);
    });
  });

  describe('disabling', () => {

    it('can be disabled', () => {
      createTestComponent(DisabledSlider);
      // initial value is 42
      expect(sliderInstance.value).toBe(42);

      const rightArrowEvent = createKeyboardEvent(RIGHT_ARROW);
      sliderInstance.handleKeypress(rightArrowEvent);
      // value of disabled slider should not have changed
      expect(sliderInstance.value).toBe(42);
      expect(sliderNativeElement.hasAttribute('aria-disabled')).toBe(true);
      expect(sliderNativeElement.tabIndex).toBe(-1);
      expect(sliderNativeElement.classList).toContain('nx-slider--disabled');
    });
  });

  describe('no thumb label', () => {

    it('does not show thumb label', () => {
      createTestComponent(ConfigurableSlider);
      const thumbLabel = fixture.nativeElement.querySelector('.nx-slider__value');
      expect(testInstance.sliderInstance.thumbLabel).toBe(false);
      expect(thumbLabel).toBeNull();
    });
  });

  describe('no min & max labels', () => {

    it('does not show min & max labels', () => {
      createTestComponent(ConfigurableSlider);
      const minMaxLabels = fixture.nativeElement.querySelector('.nx-slider__label-container');
      expect(testInstance.sliderInstance.minMaxLabels).toBe(false);
      expect(minMaxLabels).toBeNull();
    });
  });

  describe('with negative vales', () => {

    it('should be able to handle negative values', () => {
      createTestComponent(NegativeSlider);
      const event = new MouseEvent('MouseEvent', {
        screenX: 20,
        clientX: 20,
        screenY: 10,
        clientY: 10
      });
      sliderInstance.sliderClick(event);
      sliderInstance.valueByPosition();

      const value = sliderInstance.value;
      expect(value).toBe(-30);
      expect(sliderInstance.percentageValue).toBe(20);
    });
  });

  describe('with float values', () => {

    it('should be able to handle float values', () => {
      createTestComponent(FloatSlider);
      const event = new MouseEvent('MouseEvent', {
        screenX: 20,
        clientX: 20,
        screenY: 10,
        clientY: 10
      });
      sliderInstance.sliderClick(event);
      sliderInstance.valueByPosition();

      const value = sliderInstance.value;
      expect(value).toBe(0.2);
      expect(sliderInstance.percentageValue).toBe(20);
    });

    it('should truncate long decimal values based on step', () => {
      createTestComponent(TruncateTestSlider);

      // simulate the dragging of the slider
      dispatchSlideEvent({ x: 0, y: 10 }, { x: 85, y: 85 });
      sliderInstance.valueByPosition();

      const value = sliderInstance.value;
      // 1.7 is one of the first values that break
      expect(value).toBe(1.7);
    });

    it('should truncate long decimal values by keyboard events', () => {
      createTestComponent(FloatSlider);
      const rightArrowEvent = createKeyboardEvent(RIGHT_ARROW);
      sliderInstance.handleKeypress(rightArrowEvent);
      expect(sliderInstance.value).toBe(0.1);
      sliderInstance.handleKeypress(rightArrowEvent);
      expect(sliderInstance.value).toBe(0.2);
      sliderInstance.handleKeypress(rightArrowEvent);
      // 0.3 usually breaks to 0.30000000000000004 if not handled correctly
      expect(sliderInstance.value).toBe(0.3);
    });
  });

  describe('with simple binding', () => {

    it('should set initial value correctly', () => {
      createTestComponent(SimpleBindingSlider);
      expect(sliderInstance.value).toBe(10);
      expect(getFillerWidth()).toBe('10%');
    });

    it('should have working two way binding', () => {
      createTestComponent(SimpleBindingSlider);
    });
  });

  describe('with ngModel', () => {

    it('should write the model value', fakeAsync(() => {
      createTestComponent(NgModelSlider);
      tick();
      fixture.detectChanges();
      expect(sliderInstance.value).toBe(10);
      expect(getFillerWidth()).toBe('10%');
    }));

    it('should update the model value after sliding', () => {
      createTestComponent(NgModelSlider);
    });
  });

  describe('with reactive forms', () => {

    it('should write the form control value', () => {
      createTestComponent(ReactiveFormsSlider);
      expect(sliderInstance.value).toBe(10);
      expect(getFillerWidth()).toBe('10%');
    });

    it('should update form value after sliding', () => {
      createTestComponent(ReactiveFormsSlider);
    });

    it('should toggle disabled', () => {
      createTestComponent(ReactiveFormsSlider);
      const instance = testInstance as ReactiveFormsSlider;
      instance.testForm.controls.slide.disable();
      fixture.detectChanges();
      expect(sliderNativeElement.classList).toContain('nx-slider--disabled');
      expect(testInstance.sliderInstance.disabled).toBe(true);
      expect(sliderNativeElement.hasAttribute('aria-disabled')).toBe(true);

      instance.testForm.controls.slide.enable();
      fixture.detectChanges();
      expect(sliderNativeElement.classList).not.toContain('nx-slider--disabled');
      expect(testInstance.sliderInstance.disabled).toBe(false);
      expect(sliderNativeElement.hasAttribute('aria-disabled')).toBe(false);
    });
  });

  describe('programmatic change', () => {

    it('should update after tabindex change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.tabindex = 5;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.nx-slider__handle').getAttribute('tabindex')).toBe('5');
    });

    it('should update after label change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.label = 'programmatic label';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.nx-slider__label').textContent.trim()).toBe('programmatic label');
    });

    it('should update after disabled change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.disabled = true;
      fixture.detectChanges();
      expect(sliderNativeElement.classList).toContain('nx-slider--disabled');
    });

    it('should update after inverted change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.inverted = true;
      fixture.detectChanges();
      expect(getFillerWidth()).toBe('100%');

      testInstance.sliderInstance.inverted = false;
      fixture.detectChanges();
      expect(getFillerWidth()).toBe('0%');
    });

    it('should update after value change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.value = 50;
      fixture.detectChanges();
      expect(getFillerWidth()).toBe('50%');
    });

    it('should update after min change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.min = -100;
      fixture.detectChanges();
      expect(getFillerWidth()).toBe('50%');
    });

    it('should update after max change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.value = 25;
      fixture.detectChanges();
      expect(getFillerWidth()).toBe('25%');
      testInstance.sliderInstance.max = 50;
      fixture.detectChanges();
      expect(getFillerWidth()).toBe('50%');
    });

    it('should update after disabled change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.negative = true;
      fixture.detectChanges();
      expect(sliderNativeElement.classList).toContain('nx-slider--negative');
    });

    it('should update after id change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.id = 'slider-with-id';
      fixture.detectChanges();
      const labelElement: HTMLLabelElement = sliderNativeElement.querySelector('label');
      const anchorElement: HTMLElement = sliderNativeElement.querySelector('.nx-slider__handle');
      expect(labelElement.id).toBe('slider-with-id-label');
      expect(anchorElement.id).toBe('slider-with-id-handle');
    });

    it('should update after thumb label change', () => {
      createTestComponent(BasicSliderOnPush);
      testInstance.sliderInstance.thumbLabel = false;
      fixture.detectChanges();
      let thumbLabel = fixture.nativeElement.querySelector('.nx-slider__value');
      expect(testInstance.sliderInstance.thumbLabel).toBe(false);
      expect(thumbLabel).toBeNull();

      testInstance.sliderInstance.thumbLabel = true;
      fixture.detectChanges();
      thumbLabel = fixture.nativeElement.querySelector('.nx-slider__value');
      expect(testInstance.sliderInstance.thumbLabel).toBe(true);
      expect(thumbLabel).not.toBeNull();
    });

    it('Should emit change event only once on drag', () => {
      createTestComponent(BasicSlider);
      const onChangeSpy = jasmine.createSpy('slider onChange');
      sliderInstance.valueChange.subscribe(onChangeSpy);
      dispatchSlideEvent({ x: 30, y: 10 }, { x: 260, y: 10 });
      sliderInstance.valueByPosition();
      fixture.detectChanges();
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('a11y', () => {

    it('should handle keyboard events', () => {
      createTestComponent(BasicSlider);

      expect(sliderInstance.value).toBe(0);

      const rightArrowEvent = createKeyboardEvent(RIGHT_ARROW);
      sliderInstance.handleKeypress(rightArrowEvent);
      expect(sliderInstance.value).toBe(1);

      const upArrowEvent = createKeyboardEvent(UP_ARROW);
      sliderInstance.handleKeypress(upArrowEvent);
      expect(sliderInstance.value).toBe(2);

      const leftArrowEvent = createKeyboardEvent(LEFT_ARROW);
      sliderInstance.handleKeypress(leftArrowEvent);
      expect(sliderInstance.value).toBe(1);

      const downArrowEvent = createKeyboardEvent(DOWN_ARROW);
      sliderInstance.handleKeypress(downArrowEvent);
      expect(sliderInstance.value).toBe(0);
    });

    it('should handle keyboard events correctly if inverted', () => {
      createTestComponent(InvertedSlider);

      expect(sliderInstance.value).toBe(0);

      const leftArrowEvent = createKeyboardEvent(LEFT_ARROW);
      sliderInstance.handleKeypress(leftArrowEvent);
      expect(sliderInstance.value).toBe(1);

      const upArrowEvent = createKeyboardEvent(UP_ARROW);
      sliderInstance.handleKeypress(upArrowEvent);
      expect(sliderInstance.value).toBe(2);

      const rightArrowEvent = createKeyboardEvent(RIGHT_ARROW);
      sliderInstance.handleKeypress(rightArrowEvent);
      expect(sliderInstance.value).toBe(1);

      const downArrowEvent = createKeyboardEvent(DOWN_ARROW);
      sliderInstance.handleKeypress(downArrowEvent);
      expect(sliderInstance.value).toBe(0);
    });

    it('should focus the handle element by clicking on the label', () => {
      createTestComponent(BasicSlider);
      const label = fixture.nativeElement.querySelector('.nx-slider__label');
      label.click();
      const handle = fixture.nativeElement.querySelector('.nx-slider__handle');
      expect(document.activeElement).toBe(handle);
    });

    it('has no accessbility violations', function (done) {
      createTestComponent(BasicSlider);

      axe.run(fixture.nativeElement, {}, (error: Error, results: axe.AxeResults) => {
        expect(results.violations.length).toBe(0);
        // const violationMessages = results.violations.map(item => item.description);
        done();
      });
    });
  });
});

// make the slider 100px wide and position it reliably, so we have nice predictable coordinates for simulated clicks
const styles = `
  .slider-container { width: 100px; position: absolute; top: 0; left: 0;}
`;

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        id="testSlider"
        nxLabel="testLabel">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class BasicSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        id="testSlider"
        nxLabel="testLabel">
      </nx-slider>
    </div>
  `,
  styles: [styles],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class BasicSliderOnPush extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container" [style.width.px]="width">
      <nx-slider
        id="testSlider"
        nxLabel="testLabel"
        [nxMin]="min"
        [nxMax]="max"
        [nxStep]="stepSize"
        [nxValue]="value"
        [thumbLabel]="thumblabel"
        [minMaxLabels]="minMaxLabels">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class ConfigurableSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        [nxMin]="-50"
        [nxMax]="50"
        [nxStep]="1">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class NegativeSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        [nxMin]="0"
        [nxMax]="2"
        [nxStep]="0.1">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class TruncateTestSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        [nxMin]="0"
        [nxMax]="1"
        [nxStep]="0.1">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class FloatSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        [nxValue]="42"
        [disabled]=true>
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class DisabledSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider
        [nxInverted]=true>
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class InvertedSlider extends SliderTest {
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider [(nxValue)]="value">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class SimpleBindingSlider extends SliderTest {
  value = 10;
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider [(ngModel)]="value">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class NgModelSlider extends SliderTest {
  value = 10;
}

@Component({
  template: `
    <div class="slider-container">
      <nx-slider [formControl]="testForm.controls.slide">
      </nx-slider>
    </div>
  `,
  styles: [styles]
})
class ReactiveFormsSlider extends SliderTest {
  testForm = new FormBuilder().group({
    slide: new FormControl(10)
  });
}
