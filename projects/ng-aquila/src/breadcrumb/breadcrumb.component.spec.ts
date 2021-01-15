import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NxBreadcrumbComponent } from './breadcrumb.component';
import { Component, ChangeDetectionStrategy, ViewChild, ViewChildren, QueryList, Type, Directive } from '@angular/core';
import { NxBreadcrumbItemComponent } from './breadcrumb-item.component';
import { NxBreadcrumbModule } from './breadcrumb.module';

@Directive()
abstract class BreadcrumbTest {
  @ViewChild(NxBreadcrumbComponent) breadcrumbInstance: NxBreadcrumbComponent;
  @ViewChildren(NxBreadcrumbItemComponent) breadcrumbItems: QueryList<NxBreadcrumbItemComponent>;
}

describe('NxBreadcrumbComponent', () => {
  let fixture: ComponentFixture<BreadcrumbTest>;
  let testInstance: BreadcrumbTest;
  let breadcrumbItemInstances: QueryList<HTMLElement>;

  function createTestComponent(component: Type<BreadcrumbTest>) {
    fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    testInstance = fixture.componentInstance;
    breadcrumbItemInstances = (fixture.nativeElement.querySelectorAll('.nx-breadcrumb-item') as QueryList<HTMLElement>);
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        NxBreadcrumbModule
      ],
      declarations: [
        BasicBreadcrumbComponent,
        BreadcrumbOnPushComponent,
        DynamicBreadcrumbComponent
      ]
    }).compileComponents();
  }));

  it('should create the breadcrumb component', () => {
    createTestComponent(BasicBreadcrumbComponent);
    expect(testInstance.breadcrumbInstance).toBeTruthy();
    expect(testInstance.breadcrumbItems).toBeTruthy();
  });

  it('should apply negative style on programmatic change', () => {
    createTestComponent(BreadcrumbOnPushComponent);
    expect(fixture.nativeElement.querySelector('.is-negative')).toBeTruthy();
    testInstance.breadcrumbInstance.negative = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.is-negative')).toBeFalsy();
  });

  it('should change negative style via input', () => {
    createTestComponent(BasicBreadcrumbComponent);
    expect(fixture.nativeElement.querySelector('.is-negative')).toBeFalsy();
    (testInstance as BasicBreadcrumbComponent).negative = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.is-negative')).toBeTruthy();
    expect(testInstance.breadcrumbInstance.negative).toBe(true);
  });

  it('sets aria-current to last item', () => {
    createTestComponent(DynamicBreadcrumbComponent);
    expect(breadcrumbItemInstances[0].getAttribute('aria-current')).toBeFalsy();
    expect(breadcrumbItemInstances[1].getAttribute('aria-current')).toBeFalsy();
    expect(breadcrumbItemInstances[2].getAttribute('aria-current')).toBe('page');

    (testInstance as DynamicBreadcrumbComponent).items = ['test', 'test2'];
    fixture.detectChanges();
    breadcrumbItemInstances = fixture.nativeElement.querySelectorAll('.nx-breadcrumb-item');

    expect(breadcrumbItemInstances[0].getAttribute('aria-current')).toBeFalsy();
    expect(breadcrumbItemInstances[1].getAttribute('aria-current')).toBe('page');
  });
});

@Component({
  template: `
    <ol nxBreadcrumb [negative]="negative">
       <li>
        <a nxBreadcrumbItem>
          test
        </a>
        <a nxBreadcrumbItem>
          test 2
        </a>
      </li>
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class BreadcrumbOnPushComponent extends BreadcrumbTest {
  negative = true;
}

@Component({
  template: `
    <ol nxBreadcrumb [negative]="negative">
      <li>
        <a nxBreadcrumbItem>
          test
        </a>
      </li>
      <li>
        <a nxBreadcrumbItem>
          test 2
        </a>
      </li>
    </ol>
  `
})
class BasicBreadcrumbComponent extends BreadcrumbTest {
  negative = false;
}

@Component({
  template: `
    <ol nxBreadcrumb>
      <li *ngFor="let item of items">
        <a nxBreadcrumbItem>
          {{item}}
        </a>
      </li>
    </ol>
  `
})
class DynamicBreadcrumbComponent extends BreadcrumbTest {
  items = [
    'Home',
    'Test',
    'Test2'
  ];
}
