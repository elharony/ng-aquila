import { TestBed, ComponentFixture, tick, fakeAsync, waitForAsync } from '@angular/core/testing';
import { NxComparisonTableCell } from './cell.component';
import { DebugElement, Type, Component, ViewChild, ViewChildren, Directive, QueryList } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NxComparisonTableModule } from '../comparison-table.module';
import * as axe from 'axe-core';
import { NxComparisonTableDescriptionCell } from '../description-cell/description-cell.component';
import { NxToggleSectionDirective } from '../toggle-section/toggle-section.directive';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BASIC_COMPARISON_TABLE_TEMPLATE } from '../comparison-table.component.spec';

declare var viewport: any;
const THROTTLE_TIME = 200;

@Directive()
abstract class CellTest {
  @ViewChildren(NxComparisonTableCell) cellInstances: QueryList<NxComparisonTableCell>;
  @ViewChild(NxComparisonTableDescriptionCell) descriptionCellInstance: NxComparisonTableDescriptionCell;
  @ViewChild(NxToggleSectionDirective) toggleSectionInstance: NxToggleSectionDirective;

  selected = 0;
  headerTestId = 'header-cell-0';
}

describe('NxComparisonTableCell', () => {
  let fixture: ComponentFixture<CellTest>;
  let testInstance: CellTest;
  let cellInstances: QueryList<NxComparisonTableCell>;
  let cellElements: DebugElement[];
  let descriptionCellInstance: NxComparisonTableDescriptionCell;
  let toggleSectionInstance: NxToggleSectionDirective;

  function createTestComponent(component: Type<CellTest>) {
    fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    testInstance = fixture.componentInstance;
    cellInstances = (testInstance as CellTest).cellInstances;
    descriptionCellInstance = (testInstance as CellTest).descriptionCellInstance;
    toggleSectionInstance = (testInstance as CellTest).toggleSectionInstance;
    cellElements = fixture.debugElement.queryAll(By.css('.nx-comparison-table__cell'));
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ NxComparisonTableModule, BrowserAnimationsModule ],
      declarations: [ BasicCellComponent, ConfigurableCellComponent, ToggleSectionCellComponent ]
    });
    TestBed.compileComponents();
  }));

  describe('basic', () => {
    it('renders the content', () => {
      createTestComponent(BasicCellComponent);
      expect(cellElements.length).toBe(3);
      expect(cellElements[0].nativeElement.textContent).toBe('This is a header cell');
      expect(cellElements[1].nativeElement.textContent).toBe('This is a cell');
      expect(cellElements[2].nativeElement.textContent).toBe('This is a footer cell');
    });

    it('should set ids correctly', () => {
      createTestComponent(BasicCellComponent);
      cellInstances.forEach(cell => {
        expect(cell.id).toMatch(/^nx-comparison-table-cell-[0-9]+$/);
      });
      cellElements.forEach(cell => {
        expect(cell.nativeElement.id).toMatch(/^nx-comparison-table-cell-[0-9]+$/);
      });
    });

    it('should set id on input change', () => {
      createTestComponent(ConfigurableCellComponent);
      expect(cellInstances.toArray()[0].id).toBe('header-cell-0');
      expect(cellElements[0].nativeElement.id).toBe('header-cell-0');

      testInstance.headerTestId = 'header-test-cell';
      fixture.detectChanges();
      expect(cellInstances.toArray()[0].id).toBe('header-test-cell');
      expect(cellElements[0].nativeElement.id).toBe('header-test-cell');
    });

    it('should set the type correctly and has default type "content"', () => {
      createTestComponent(ConfigurableCellComponent);
      expect(cellInstances.toArray()[0].type).toBe('header');
      expect(cellInstances.toArray()[1].type).toBe('content');
      expect(cellInstances.toArray()[2].type).toBe('footer');
    });
  });

  describe('responsive behaviour', () => {
    it('renders the content (mobile)', fakeAsync(() => {
      viewport.set('mobile');
      window.dispatchEvent(new Event('resize'));

      createTestComponent(BasicCellComponent);

      tick(THROTTLE_TIME);
      fixture.detectChanges();

      const mobileHeaderCell = fixture.debugElement.query(By.css('.nx-comparison-table__mobile-header-cell'));
      expect(mobileHeaderCell.nativeElement.textContent).toBe('This is a header cell');

      cellElements =  fixture.debugElement.queryAll(By.css('.nx-comparison-table__cell'));
      expect(cellElements[0].nativeElement.textContent).toBe('This is a cell');

      // there should not be a footer cell on mobile
      expect(cellElements.length).toBe(1);
    }));

    it('should set id correctly (mobile)', fakeAsync(() => {
      viewport.set('mobile');
      window.dispatchEvent(new Event('resize'));

      createTestComponent(ConfigurableCellComponent);
      tick(THROTTLE_TIME);
      fixture.detectChanges();

      const mobileHeaderCell = fixture.debugElement.query(By.css('.nx-comparison-table__mobile-header-cell'));
      expect(mobileHeaderCell.nativeElement.id).toBe('header-cell-0');
      cellElements = fixture.debugElement.queryAll(By.css('.nx-comparison-table__cell'));
      expect(cellElements[0].nativeElement.id).toMatch(/^nx-comparison-table-cell-[0-9]+$/);
    }));

    afterEach(() => {
      viewport.reset();
    });
  });

  describe('a11y', () => {
    it('should have set the roles correctly (desktop / tablet)', fakeAsync(() => {
      createTestComponent(BasicCellComponent);

      expect(cellElements[0].attributes['role']).toBe('columnheader');
      expect(cellElements[1].attributes['role']).toBe('cell');
      expect(cellElements[2].attributes['role']).toBe('cell');

      viewport.set('tablet');
      window.dispatchEvent(new Event('resize'));
      createTestComponent(BasicCellComponent);
      tick(THROTTLE_TIME);
      fixture.detectChanges();

      expect(cellElements[0].attributes['role']).toBe('columnheader');
      expect(cellElements[1].attributes['role']).toBe('cell');
      expect(cellElements[2].attributes['role']).toBe('cell');
    }));

    it('should have set the scope correctly (mobile)', fakeAsync(() => {
      viewport.set('mobile');
      window.dispatchEvent(new Event('resize'));

      createTestComponent(BasicCellComponent);

      tick(THROTTLE_TIME);
      fixture.detectChanges();

      const mobileHeaderCell = fixture.debugElement.query(By.css('.nx-comparison-table__mobile-header-cell'));
      expect(mobileHeaderCell.attributes['scope']).toBe('row');

      cellElements =  fixture.debugElement.queryAll(By.css('.nx-comparison-table__cell'));
      expect(cellElements[0].attributes['scope']).toBe('');
    }));

    it('should have set the correct headers', fakeAsync(() => {
      createTestComponent(ConfigurableCellComponent);
      tick(THROTTLE_TIME);

      let headers = cellInstances.toArray()[1]._getHeaderIds();
      expect(headers.split(' ').length).toBe(2);
      expect(headers).toContain('header-cell-0');
      expect(headers).toContain(descriptionCellInstance.id);

      testInstance.headerTestId = 'header-test-cell';
      fixture.detectChanges();
      headers = cellInstances.toArray()[1]._getHeaderIds();
      expect(headers).toContain('header-test-cell');
      expect(headers).toContain(descriptionCellInstance.id);
    }));

    it('should have set the correct headers (with a toggle section) (desktop)', () => {
      createTestComponent(ToggleSectionCellComponent);

      const headers = cellElements[1].attributes['headers'];
      expect(headers.split(' ').length).toBe(3);
      expect(headers).toContain(cellInstances.toArray()[0].id);
      expect(headers).toContain(descriptionCellInstance.id);
      expect(headers).toContain(toggleSectionInstance.toggleSectionHeader.id);
    });

    it('should have set the correct headers (with a toggle section) (mobile)', fakeAsync(() => {
      viewport.set('mobile');
      window.dispatchEvent(new Event('resize'));
      createTestComponent(ToggleSectionCellComponent);

      tick(THROTTLE_TIME);
      fixture.detectChanges();

      cellElements = fixture.debugElement.queryAll(By.css('.nx-comparison-table__cell'));
      const headers = cellElements[0].attributes['headers'];
      expect(headers.split(' ').length).toBe(3);
      expect(headers).toContain(cellInstances.toArray()[0].id);
      expect(headers).toContain(descriptionCellInstance.id);
      expect(headers).toContain(toggleSectionInstance.toggleSectionHeader.id);
    }));

    it('has no accessibility violations', function(done) {
      createTestComponent(BasicCellComponent);

      axe.run(fixture.nativeElement, {},  (error: Error, results: axe.AxeResults) => {
        expect(results.violations.length).toBe(0);
        const violationMessages = results.violations.map(item => item.description);
        if (violationMessages.length) {
          console.error(violationMessages);
          expect(violationMessages).toBeFalsy();
        }
        done();
      });
    });

    afterEach(() => {
      viewport.reset();
    });
  });
});

@Component({
  template: `
    <nx-comparison-table>
      <ng-container nxComparisonTableRow type="header">
        <nx-comparison-table-cell type="header">This is a header cell</nx-comparison-table-cell>
      </ng-container>
      <ng-container nxComparisonTableRow>
        <nx-comparison-table-description-cell>This is a description cell</nx-comparison-table-description-cell>
        <nx-comparison-table-cell>This is a cell</nx-comparison-table-cell>
      </ng-container>
      <ng-container nxComparisonTableRow type="footer">
        <nx-comparison-table-cell type="footer">This is a footer cell</nx-comparison-table-cell>
      </ng-container>
    </nx-comparison-table>
 `
})
class BasicCellComponent extends CellTest { }

@Component({
  template: `
  <nx-comparison-table [selectedIndex]="selected">
    <ng-container nxComparisonTableRow type="header">
      <nx-comparison-table-cell type="header" [id]="headerTestId">This is a header cell</nx-comparison-table-cell>
    </ng-container>
    <ng-container nxComparisonTableRow>
      <nx-comparison-table-description-cell>This is a description cell</nx-comparison-table-description-cell>
      <nx-comparison-table-cell>This is a cell</nx-comparison-table-cell>
    </ng-container>
    <ng-container nxComparisonTableRow type="footer">
      <nx-comparison-table-cell type="footer">This is a footer cell</nx-comparison-table-cell>
    </ng-container>
  </nx-comparison-table>
 `
})
class ConfigurableCellComponent extends CellTest { }

@Component({
  template: BASIC_COMPARISON_TABLE_TEMPLATE
})
class ToggleSectionCellComponent extends CellTest {
  data =  [
    { type: 'header', cells: [ 'This is a header cell' ] },
    {
      type: 'toggleSection', header: 'Toggle section header',
      content: [
        { type: 'content', description: 'This is a description cell', cells: [ 'This is an intersection cell' ] },
      ]
    },
    { type: 'footer', cells: [ 'This is a footer cell' ] },
  ];
}
