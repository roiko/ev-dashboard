import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { AuthorizationService } from '../../../../services/authorization.service';
import { CentralServerService } from '../../../../services/central-server.service';
import { DialogService } from '../../../../services/dialog.service';
import { MessageService } from '../../../../services/message.service';
import { SpinnerService } from '../../../../services/spinner.service';
import { ChargingStationsDialogComponent } from '../../../../shared/dialogs/charging-stations/charging-stations-dialog.component';
import { TableAddAction } from '../../../../shared/table/actions/table-add-action';
import { TableRemoveAction } from '../../../../shared/table/actions/table-remove-action';
import { TableDataSource } from '../../../../shared/table/table-data-source';
import { ChargingStation } from '../../../../types/ChargingStation';
import { DataResult } from '../../../../types/DataResult';
import { ButtonAction, RestResponse } from '../../../../types/GlobalType';
import { HTTPError } from '../../../../types/HTTPError';
import { SiteArea } from '../../../../types/SiteArea';
import { ButtonType, TableActionDef, TableColumnDef, TableDef } from '../../../../types/Table';
import { Utils } from '../../../../utils/Utils';

@Injectable()
export class SiteAreaChargingStationsDataSource extends TableDataSource<ChargingStation> {
  private siteArea!: SiteArea;
  private addAction = new TableAddAction().getActionDef();
  private removeAction = new TableRemoveAction().getActionDef();
  private canReadSiteArea = false;
  private canCreateSiteArea = false;
  private canUpdateSiteArea = false;
  private canDeleteSiteArea = false;

  public constructor(
    public spinnerService: SpinnerService,
    public translateService: TranslateService,
    private messageService: MessageService,
    private router: Router,
    private dialog: MatDialog,
    private dialogService: DialogService,
    private centralServerService: CentralServerService,
    private authorizationService: AuthorizationService) {
    super(spinnerService, translateService);
    this.canReadSiteArea = this.authorizationService.canReadSiteArea();
    this.canCreateSiteArea = this.authorizationService.canCreateSiteArea();
    this.canUpdateSiteArea = this.authorizationService.canUpdateSiteArea();
    this.canDeleteSiteArea = this.authorizationService.canDeleteSiteArea();
  }

  public loadDataImpl(): Observable<DataResult<ChargingStation>> {
    return new Observable((observer) => {
      // siteArea provided?
      if (this.siteArea) {
        // Yes: Get data
        this.centralServerService.getChargingStations(this.buildFilterValues(),
          this.getPaging(), this.getSorting()).subscribe((chargingStations) => {
          observer.next(chargingStations);
          observer.complete();
        }, (error) => {
          // No longer exists!
          Utils.handleHttpError(error, this.router, this.messageService, this.centralServerService, 'general.error_backend');
          // Error
          observer.error(error);
        });
      } else {
        // Ok
        observer.next({
          count: 0,
          result: [],
        });
        observer.complete();
      }
    });
  }

  public buildTableDef(): TableDef {
    if (this.siteArea?.issuer) {
      if ((this.canReadSiteArea && this.canCreateSiteArea && this.canUpdateSiteArea && this.canDeleteSiteArea) ||
        this.authorizationService.isSiteAdmin(this.siteArea.siteID)) {
        return {
          class: 'table-dialog-list',
          rowSelection: {
            enabled: true,
            multiple: true,
          },
          search: {
            enabled: true,
          },
        };
      }
    }
    return {
      class: 'table-dialog-list',
      rowSelection: {
        enabled: false,
        multiple: false,
      },
      search: {
        enabled: false,
      },
    };
  }

  public buildTableColumnDefs(): TableColumnDef[] {
    return [
      {
        id: 'id',
        name: 'chargers.chargers',
        headerClass: 'col-35p',
        class: 'text-left',
        sorted: true,
        direction: 'asc',
        sortable: true,
      },
      {
        id: 'chargePointVendor',
        name: 'chargers.vendor',
        headerClass: 'col-50p',
        class: 'text-left',
        sorted: true,
        direction: 'asc',
        sortable: true,
      },
    ];
  }

  public setSiteArea(siteArea: SiteArea) {
    // Set static filter
    this.setStaticFilters([
      { SiteAreaID: siteArea.id },
    ]);
    // Set user
    this.siteArea = siteArea;
    this.initDataSource(true);
  }

  public buildTableActionsDef(): TableActionDef[] {
    const tableActionsDef = super.buildTableActionsDef();
    if (this.siteArea?.issuer) {
      if (((this.canReadSiteArea && this.canCreateSiteArea && this.canUpdateSiteArea && this.canDeleteSiteArea) ||
        this.authorizationService.isSiteAdmin(this.siteArea.siteID))) {
        return [
          this.addAction,
          this.removeAction,
          ...tableActionsDef,
        ];
      }
    }
    return tableActionsDef;
  }

  public actionTriggered(actionDef: TableActionDef) {
    // Action
    switch (actionDef.id) {
      // Add
      case ButtonAction.ADD:
        this.showAddChargersDialog();
        break;

      // Remove
      case ButtonAction.REMOVE:
        // Empty?
        if (Utils.isEmptyArray(this.getSelectedRows())) {
          this.messageService.showErrorMessage(this.translateService.instant('general.select_at_least_one_record'));
        } else {
          // Confirm
          this.dialogService.createAndShowYesNoDialog(
            this.translateService.instant('site_areas.remove_chargers_title'),
            this.translateService.instant('site_areas.remove_chargers_confirm'),
          ).subscribe((response) => {
            // Check
            if (response === ButtonType.YES) {
              // Remove
              this.removeChargers(this.getSelectedRows().map((row) => row.id));
            }
          });
        }
        break;
    }
  }

  public showAddChargersDialog() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.panelClass = 'transparent-dialog-container';
    // Set data
    dialogConfig.data = {
      staticFilter: {
        WithNoSiteArea: true,
        Issuer: true,
      },
    };
    // Show
    const dialogRef = this.dialog.open(ChargingStationsDialogComponent, dialogConfig);
    // Register to the answer
    dialogRef.afterClosed().subscribe((chargers) => this.addChargers(chargers));
  }

  private removeChargers(chargerIDs: string[]) {
    // Yes: Update
    this.centralServerService.removeChargersFromSiteArea(this.siteArea.id, chargerIDs).subscribe((response) => {
      // Ok?
      if (response.status === RestResponse.SUCCESS) {
        // Ok
        this.messageService.showSuccessMessage(this.translateService.instant('site_areas.remove_chargers_success'));
        // Refresh
        this.refreshData().subscribe();
        // Clear selection
        this.clearSelectedRows();
      } else {
        Utils.handleError(JSON.stringify(response),
          this.messageService, this.translateService.instant('site_areas.remove_chargers_error'));
      }
    }, (error) => {
      // No longer exists!
      Utils.handleHttpError(error, this.router, this.messageService, this.centralServerService, 'site_areas.remove_chargers_error');
    });
  }

  private addChargers(chargers: ChargingStation[]) {
    // Check
    if (!Utils.isEmptyArray(chargers)) {
      // Get the IDs
      const chargerIDs = chargers.map((charger) => charger.key);
      // Yes: Update
      this.centralServerService.addChargersToSiteArea(this.siteArea.id, chargerIDs).subscribe((response) => {
        // Ok?
        if (response.status === RestResponse.SUCCESS) {
          // Ok
          this.messageService.showSuccessMessage(this.translateService.instant('site_areas.update_chargers_success'));
          // Refresh
          this.refreshData().subscribe();
          // Clear selection
          this.clearSelectedRows();
        } else {
          Utils.handleError(JSON.stringify(response),
            this.messageService, this.translateService.instant('site_areas.update_error'));
        }
      }, (error) => {
        switch (error.status) {
          case HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA:
            this.messageService.showErrorMessage('chargers.change_config_phase_error');
            break;
          default:
            // No longer exists!
            Utils.handleHttpError(error, this.router, this.messageService, this.centralServerService, 'site_areas.update_error');
        }
      });
    }
  }
}
