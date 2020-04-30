import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { AssetDialogComponent } from 'app/pages/assets/asset/asset.dialog.component';
import { Asset, AssetButtonAction } from 'app/types/Asset';
import { ButtonColor, TableActionDef } from 'app/types/Table';
import { Observable } from 'rxjs';
import { TableAction } from './table-action';

export class TableEditAssetAction implements TableAction {
  private action: TableActionDef = {
    id: AssetButtonAction.EDIT_ASSET,
    type: 'button',
    icon: 'edit',
    color: ButtonColor.PRIMARY,
    name: 'general.edit',
    tooltip: 'general.tooltips.edit',
    action: this.editAsset,
  };

  public getActionDef(): TableActionDef {
    return this.action;
  }

  private editAsset(asset: Asset, dialog: MatDialog, refresh?: () => Observable<void>) {
    // Create the dialog
    const dialogConfig = new MatDialogConfig();
    dialogConfig.minWidth = '80vw';
    dialogConfig.minHeight = '80vh';
    dialogConfig.panelClass = 'transparent-dialog-container';
    if (asset) {
      dialogConfig.data = asset.id;
    }
    // disable outside click close
    dialogConfig.disableClose = true;
    // Open
    const dialogRef = dialog.open(AssetDialogComponent, dialogConfig);
    dialogRef.afterClosed().subscribe((saved) => {
      if (saved) {
        if (refresh) {
          refresh().subscribe();
        }
      }
    });
  }
}
