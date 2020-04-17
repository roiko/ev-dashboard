import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { SpinnerService } from 'app/services/spinner.service';
import { TableCreateAction } from 'app/shared/table/actions/table-create-action';
import { TableForceSyncBillingUserAction } from 'app/shared/table/actions/table-force-sync-billing-user-action';
import { TableMoreAction } from 'app/shared/table/actions/table-more-action';
import { DataResult } from 'app/types/DataResult';
import { ButtonAction, RestResponse } from 'app/types/GlobalType';
import { HTTPError } from 'app/types/HTTPError';
import { UserInError } from 'app/types/InError';
import { SiteButtonAction } from 'app/types/Site';
import { ButtonType, TableActionDef, TableColumnDef, TableDef, TableFilterDef } from 'app/types/Table';
import { Tag } from 'app/types/Tag';
import TenantComponents from 'app/types/TenantComponents';
import { User, UserButtonAction, UserToken } from 'app/types/User';
import { Observable } from 'rxjs';
import { AuthorizationService } from '../../../services/authorization.service';
import { CentralServerNotificationService } from '../../../services/central-server-notification.service';
import { CentralServerService } from '../../../services/central-server.service';
import { ComponentService } from '../../../services/component.service';
import { DialogService } from '../../../services/dialog.service';
import { MessageService } from '../../../services/message.service';
import { AppArrayToStringPipe } from '../../../shared/formatters/app-array-to-string.pipe';
import { AppDatePipe } from '../../../shared/formatters/app-date.pipe';
import { AppUserNamePipe } from '../../../shared/formatters/app-user-name.pipe';
import { TableAssignSitesAction } from '../../../shared/table/actions/table-assign-sites-action';
import { TableAutoRefreshAction } from '../../../shared/table/actions/table-auto-refresh-action';
import { TableDeleteAction } from '../../../shared/table/actions/table-delete-action';
import { TableEditAction } from '../../../shared/table/actions/table-edit-action';
import { TableRefreshAction } from '../../../shared/table/actions/table-refresh-action';
import { TableSyncBillingUsersAction } from '../../../shared/table/actions/table-sync-billing-users-action';
import { IssuerFilter } from '../../../shared/table/filters/issuer-filter';
import { TableDataSource } from '../../../shared/table/table-data-source';
import { Action, Entity } from '../../../types/Authorization';
import ChangeNotification from '../../../types/ChangeNotification';
import { Utils } from '../../../utils/Utils';
import { UserRoleFilter } from '../filters/user-role-filter';
import { UserStatusFilter } from '../filters/user-status-filter';
import { AppUserRolePipe } from '../formatters/user-role.pipe';
import { UserStatusFormatterComponent } from '../formatters/user-status-formatter.component';
import { UserSitesDialogComponent } from '../user-sites/user-sites-dialog.component';
import { UserDialogComponent } from '../user/user.dialog.component';

@Injectable()
export class UsersListTableDataSource extends TableDataSource<User> {
  private editAction = new TableEditAction().getActionDef();
  private assignSiteAction = new TableAssignSitesAction().getActionDef();
  private deleteAction = new TableDeleteAction().getActionDef();
  private tableSyncBillingUsersAction = new TableSyncBillingUsersAction().getActionDef();
  private forceSyncBillingUserAction = new TableForceSyncBillingUserAction().getActionDef();
  private currentUser: UserToken;

  constructor(
      public spinnerService: SpinnerService,
      public translateService: TranslateService,
      private messageService: MessageService,
      private dialogService: DialogService,
      private router: Router,
      private dialog: MatDialog,
      private centralServerNotificationService: CentralServerNotificationService,
      private centralServerService: CentralServerService,
      private authorizationService: AuthorizationService,
      private componentService: ComponentService,
      private appUserRolePipe: AppUserRolePipe,
      private appUserNamePipe: AppUserNamePipe,
      private arrayToStringPipe: AppArrayToStringPipe,
      private datePipe: AppDatePipe) {
    super(spinnerService, translateService);
    // Init
    if (this.authorizationService.hasSitesAdminRights()) {
      this.setStaticFilters([{ SiteID: this.authorizationService.getSitesAdmin().join('|') }]);
    }
    this.initDataSource();
    // Store the current user
    this.currentUser = this.centralServerService.getLoggedUser();
  }

  public getDataChangeSubject(): Observable<ChangeNotification> {
    return this.centralServerNotificationService.getSubjectUsers();
  }

  public loadDataImpl(): Observable<DataResult<User>> {
    return new Observable((observer) => {
      // Get the Tenants
      this.centralServerService.getUsers(this.buildFilterValues(),
        this.getPaging(), this.getSorting()).subscribe((users) => {
        // Ok
        observer.next(users);
        observer.complete();
      }, (error) => {
        // Show error
        Utils.handleHttpError(error, this.router, this.messageService, this.centralServerService, 'general.error_backend');
        // Error
        observer.error(error);
      });
    });
  }

  public buildTableDef(): TableDef {
    return {
      search: {
        enabled: true,
      },
      hasDynamicRowAction: true,
    };
  }

  public buildTableColumnDefs(): TableColumnDef[] {
    const loggedUserRole = this.centralServerService.getLoggedUser().role;
    const columns = [];
    columns.push(
      {
        id: 'status',
        name: 'users.status',
        isAngularComponent: true,
        angularComponent: UserStatusFormatterComponent,
        headerClass: 'col-10p',
        class: 'col-10p table-cell-angular-big-component',
        sortable: true,
      },
      {
        id: 'role',
        name: 'users.role',
        formatter: (role: string) => role ? this.translateService.instant(this.appUserRolePipe.transform(role, loggedUserRole)) : '-',
        headerClass: 'col-10p',
        class: 'text-left col-10p',
        sortable: true,
      },
      {
        id: 'name',
        name: 'users.name',
        headerClass: 'col-15p',
        class: 'text-left col-15p',
        sorted: true,
        direction: 'asc',
        sortable: true,
      },
      {
        id: 'firstName',
        name: 'users.first_name',
        headerClass: 'col-15p',
        class: 'text-left col-15p',
        sortable: true,
      },
      {
        id: 'email',
        name: 'users.email',
        headerClass: 'col-15p',
        class: 'text-left col-15p',
        sortable: true,
      },
    );
    if (this.authorizationService.isAdmin()) {
      columns.push(
        {
          id: 'tags',
          name: 'users.tags',
          formatter: (tags: Tag[]) => this.arrayToStringPipe.transform(tags.map((tag: Tag) => tag.id)),
          headerClass: 'col-15p',
          class: 'col-15p',
          sortable: true,
        },
        {
          id: 'plateID',
          name: 'users.plate_id',
          headerClass: 'col-10p',
          class: 'col-10p',
          sortable: true,
        },
      );
    }
    columns.push(
      {
        id: 'eulaAcceptedOn',
        name: 'users.eula_accepted_on',
        formatter: (eulaAcceptedOn: Date, row: User) => {
          return eulaAcceptedOn ? this.datePipe.transform(eulaAcceptedOn) + ` (${this.translateService.instant('general.version')} ${row.eulaAcceptedVersion})` : '-';
        },
        headerClass: 'col-15p',
        class: 'col-15p',
        sortable: true,
      },
      {
        id: 'createdOn',
        name: 'users.created_on',
        formatter: (createdOn: Date) => this.datePipe.transform(createdOn),
        headerClass: 'col-15p',
        class: 'col-15p',
        sortable: true,
      },
      {
        id: 'lastChangedOn',
        name: 'users.changed_on',
        formatter: (lastChangedOn: Date) => this.datePipe.transform(lastChangedOn),
        headerClass: 'col-15p',
        class: 'col-15p',
        sortable: true,
      },
      {
        id: 'lastChangedBy',
        name: 'users.changed_by',
        headerClass: 'col-15p',
        class: 'col-15p',
        sortable: true,
      },
    );
    if (this.componentService.isActive(TenantComponents.BILLING)) {
      columns.push(
        {
          id: 'billingData.customerID',
          name: 'billing.id',
          headerClass: 'col-15p',
          class: 'col-15p',
          sortable: true,
        },
        {
          id: 'billingData.lastChangedOn',
          name: 'billing.updatedOn',
          headerClass: 'col-15p',
          formatter: (lastChangedOn: Date) => this.datePipe.transform(lastChangedOn),
          class: 'col-15p',
          sortable: true,
        },
      );
    }
    return columns as TableColumnDef[];
  }

  public buildTableActionsDef(): TableActionDef[] {
    const tableActionsDef = super.buildTableActionsDef();
    tableActionsDef.unshift(new TableCreateAction().getActionDef());
    if (this.componentService.isActive(TenantComponents.BILLING) &&
        this.authorizationService.canSynchronizeUsers()) {
      tableActionsDef.splice(1, 0, this.tableSyncBillingUsersAction);
    }
    return [
      ...tableActionsDef,
    ];
  }

  public buildTableDynamicRowActions(user: User): TableActionDef[] {
    let actions;
    if (this.componentService.isActive(TenantComponents.ORGANIZATION) &&
        this.authorizationService.canAccess(Entity.USER, Action.UPDATE) &&
        this.authorizationService.canAccess(Entity.SITE, Action.UPDATE)) {
      actions = [
        this.editAction,
        this.assignSiteAction,
      ];
    } else {
      actions = [
        this.editAction,
      ];
    }
    const moreActions = new TableMoreAction([]);
    if (this.componentService.isActive(TenantComponents.BILLING) &&
        this.authorizationService.canAccess(Entity.BILLING, Action.SYNCHRONIZE_USERS_BILLING)) {
      moreActions.addActionInMoreActions(this.forceSyncBillingUserAction);
    }
    if (this.currentUser.id !== user.id && this.authorizationService.canAccess(Entity.USER, Action.DELETE)) {
      moreActions.addActionInMoreActions(this.deleteAction);
    }
    if (moreActions.getActionsInMoreActions().length > 0) {
      actions.push(moreActions.getActionDef());
    }
    return actions;
  }

  public actionTriggered(actionDef: TableActionDef) {
    // Action
    switch (actionDef.id) {
      case ButtonAction.CREATE:
        this.showUserDialog();
        break;
      case UserButtonAction.FORCE_SYNCHRONIZE_BILLING:
        if (this.tableSyncBillingUsersAction.action) {
          this.tableSyncBillingUsersAction.action(
            this.dialogService,
            this.translateService,
            this.messageService,
            this.centralServerService,
            this.router,
          );
        }
        break;
      default:
        super.actionTriggered(actionDef);
    }
  }

  public rowActionTriggered(actionDef: TableActionDef, rowItem: User) {
    switch (actionDef.id) {
      case ButtonAction.EDIT:
        this.showUserDialog(rowItem);
        break;
      case SiteButtonAction.ASSIGN_SITE:
        this.showSitesDialog(rowItem);
        break;
      case ButtonAction.DELETE:
        this.deleteUser(rowItem);
        break;
      case UserButtonAction.FORCE_SYNCHRONIZE_BILLING:
        this.forceSynchronizeUser(rowItem);
        break;
      default:
        super.rowActionTriggered(actionDef, rowItem);
    }
  }

  private forceSynchronizeUser(user: UserInError) {
    this.dialogService.createAndShowYesNoDialog(
      this.translateService.instant('settings.billing.force_synchronize_user_dialog_title'),
      this.translateService.instant('settings.billing.force_synchronize_user_dialog_confirm', { userFullName: Utils.buildUserFullName(user) }),
    ).subscribe((response) => {
      if (response === ButtonType.YES) {
        this.spinnerService.show();
        this.centralServerService.forceSynchronizeUserForBilling(user.id).subscribe((synchronizeResponse) => {
          this.spinnerService.hide();
          if (synchronizeResponse.status === RestResponse.SUCCESS) {
            this.refreshData().subscribe();
            this.messageService.showSuccessMessage(
              this.translateService.instant('settings.billing.force_synchronize_user_success',
                { userFullName: Utils.buildUserFullName(user) }));
          } else {
            Utils.handleError(JSON.stringify(synchronizeResponse), this.messageService,
              'settings.billing.force_synchronize_user_failure');
          }
        }, (error) => {
          this.spinnerService.hide();
          this.messageService.showErrorMessage(
            this.translateService.instant(['settings.billing.billing_system_error']));
        });
      }
    });
  }

  public buildTableActionsRightDef(): TableActionDef[] {
    return [
      new TableAutoRefreshAction(false).getActionDef(),
      new TableRefreshAction().getActionDef(),
    ];
  }

  public buildTableFiltersDef(): TableFilterDef[] {
    return [
      new IssuerFilter().getFilterDef(),
      new UserRoleFilter(this.centralServerService).getFilterDef(),
      new UserStatusFilter().getFilterDef(),
    ];
  }

  public showUserDialog(user?: User) {
    // Create the dialog
    const dialogConfig = new MatDialogConfig();
    dialogConfig.minWidth = '80vw';
    dialogConfig.minHeight = '80vh';
    dialogConfig.panelClass = 'transparent-dialog-container';
    if (user) {
      dialogConfig.data = user;
    }
    // disable outside click close
    dialogConfig.disableClose = true;
    // Open
    const dialogRef = this.dialog.open(UserDialogComponent, dialogConfig);
    dialogRef.afterClosed().subscribe((saved) => {
      if (saved) {
        this.refreshData().subscribe();
      }
    });
  }

  private showSitesDialog(user?: User) {
    // Create the dialog
    const dialogConfig = new MatDialogConfig();
    dialogConfig.panelClass = 'transparent-dialog-container';
    if (user) {
      dialogConfig.data = user;
    }
    // Open
    this.dialog.open(UserSitesDialogComponent, dialogConfig);
  }

  private deleteUser(user: User) {
    this.dialogService.createAndShowYesNoDialog(
      this.translateService.instant('users.delete_title'),
      this.translateService.instant('users.delete_confirm', {userFullName: this.appUserNamePipe.transform(user)}),
    ).subscribe((result) => {
      if (result === ButtonType.YES) {
        this.centralServerService.deleteUser(user.id).subscribe((response) => {
          if (response.status === RestResponse.SUCCESS) {
            this.refreshData().subscribe();
            this.messageService.showSuccessMessage('users.delete_success', {userFullName: this.appUserNamePipe.transform(user)});
          } else {
            Utils.handleError(JSON.stringify(response),
              this.messageService, 'users.delete_error');
          }
        }, (error) => {
          switch (error.status) {
            case HTTPError.BILLING_DELETE_ERROR:
              this.messageService.showErrorMessage('users.delete_billing_error');
              break;
            default:
              Utils.handleHttpError(error, this.router, this.messageService, this.centralServerService,
                'users.delete_error');
          }
        });
      }
    });
  }
}
