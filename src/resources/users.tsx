import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import DevicesIcon from "@mui/icons-material/Devices";
import GetAppIcon from "@mui/icons-material/GetApp";
import UserIcon from "@mui/icons-material/Group";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PermMediaIcon from "@mui/icons-material/PermMedia";
import PersonPinIcon from "@mui/icons-material/PersonPin";
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import ScienceIcon from "@mui/icons-material/Science";
import ViewListIcon from "@mui/icons-material/ViewList";
import { useEffect, useState } from "react";
import { Alert, Switch, Stack, Typography } from "@mui/material";
import {
  ArrayInput,
  ArrayField,
  Button,
  Datagrid,
  DatagridConfigurable,
  DateField,
  Create,
  CreateProps,
  Edit,
  EditProps,
  List,
  ListProps,
  SimpleForm,
  SimpleFormIterator,
  TabbedForm,
  FormTab,
  BooleanField,
  BooleanInput,
  PasswordInput,
  TextField,
  TextInput,
  ReferenceField,
  ReferenceManyField,
  ResourceProps,
  SearchInput,
  SelectInput,
  DeleteButton,
  maxLength,
  regex,
  required,
  useRecordContext,
  useTranslate,
  Pagination,
  SaveButton,
  CreateButton,
  ExportButton,
  TopToolbar,
  Toolbar,
  NumberField,
  useListContext,
  useNotify,
  Identifier,
  ToolbarClasses,
  ImageInput,
  ImageField,
  FunctionField,
  useDataProvider,
} from "react-admin";
import { Link } from "react-router-dom";

import AvatarField from "../components/AvatarField";
import DeleteUserButton from "../components/DeleteUserButton";
import { isASManaged } from "../components/mxid";
import { ServerNoticeButton, ServerNoticeBulkButton } from "../components/ServerNotices";
import { DATE_FORMAT } from "../components/date";
import { DeviceRemoveButton } from "../components/devices";
import { MediaIDField, ProtectMediaButton, QuarantineMediaButton } from "../components/media";
import { generateRandomPassword } from "../synapse/synapse";
import { useFormContext } from "react-hook-form";
import { ExperimentalFeaturesList } from "../components/ExperimentalFeatures";

const choices_medium = [
  { id: "email", name: "resources.users.email" },
  { id: "msisdn", name: "resources.users.msisdn" },
];

const choices_type = [
  { id: "bot", name: "bot" },
  { id: "support", name: "support" },
];

const UserListActions = () => {
  const { isLoading, total } = useListContext();
  return (
    <TopToolbar>
      <CreateButton />
      <ExportButton disabled={isLoading || total === 0} maxResults={10000} />
      <Button component={Link} to="/import_users" label="CSV Import">
        <GetAppIcon sx={{ transform: "rotate(180deg)", fontSize: "20px" }} />
      </Button>
    </TopToolbar>
  );
};

const UserPagination = () => <Pagination rowsPerPageOptions={[10, 25, 50, 100, 500, 1000]} />;

const userFilters = [
  <SearchInput source="name" alwaysOn />,
  <BooleanInput source="guests" alwaysOn />,
  <BooleanInput label="resources.users.fields.show_deactivated" source="deactivated" alwaysOn />,
  <BooleanInput label="resources.users.fields.show_locked" source="locked" alwaysOn />,
];

const UserPreventSelfDelete: React.FC<{ children: React.ReactNode; ownUserIsSelected: boolean; asManagedUserIsSelected: boolean }> = props => {
  const ownUserIsSelected = props.ownUserIsSelected;
  const asManagedUserIsSelected = props.asManagedUserIsSelected;
  const notify = useNotify();
  const translate = useTranslate();

  const handleDeleteClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (ownUserIsSelected) {
      notify(<Alert severity="error">{translate("resources.users.helper.erase_admin_error")}</Alert>);
      ev.stopPropagation();
    } else if (asManagedUserIsSelected) {
      notify(<Alert severity="error">{translate("resources.users.helper.modify_managed_user_error")}</Alert>);
      ev.stopPropagation();
    }
  };

  return <div onClickCapture={handleDeleteClick}>{props.children}</div>;
};

const UserBulkActionButtons = () => {
  const record = useListContext();
  const [ownUserIsSelected, setOwnUserIsSelected] = useState(false);
  const [asManagedUserIsSelected, setAsManagedUserIsSelected] = useState(false);
  const selectedIds = record.selectedIds;
  const ownUserId = localStorage.getItem("user_id");

  useEffect(() => {
    setOwnUserIsSelected(selectedIds.includes(ownUserId));
    setAsManagedUserIsSelected(selectedIds.some(id => isASManaged(id)));
  }, [selectedIds]);

  return (
    <>
      <ServerNoticeBulkButton />
      <UserPreventSelfDelete ownUserIsSelected={ownUserIsSelected} asManagedUserIsSelected={asManagedUserIsSelected}>
        <DeleteUserButton
          selectedIds={selectedIds}
          confirmTitle="resources.users.helper.erase"
          confirmContent="resources.users.helper.erase_text"
        />
      </UserPreventSelfDelete>
    </>
  );
};

export const UserList = (props: ListProps) => (
  <List
    {...props}
    filters={userFilters}
    filterDefaultValues={{ guests: true, deactivated: false, locked: false }}
    sort={{ field: "name", order: "ASC" }}
    actions={<UserListActions />}
    pagination={<UserPagination />}
  >
    <DatagridConfigurable
      rowClick={(id: Identifier, resource: string) => `/${resource}/${id}`}
      bulkActionButtons={<UserBulkActionButtons />}
    >
      <AvatarField source="avatar_src" sx={{ height: "40px", width: "40px" }} sortBy="avatar_url" />
      <TextField source="id" sortBy="name" />
      <TextField source="displayname" />
      <BooleanField source="is_guest" />
      <BooleanField source="admin" />
      <BooleanField source="deactivated" />
      <BooleanField source="locked" />
      <BooleanField source="erased" sortable={false} />
      <DateField source="creation_ts" label="resources.users.fields.creation_ts_ms" showTime options={DATE_FORMAT} />
    </DatagridConfigurable>
  </List>
);

// https://matrix.org/docs/spec/appendices#user-identifiers
// here only local part of user_id
// maxLength = 255 - "@" - ":" - storage.getItem("home_server").length
// storage.getItem("home_server").length is not valid here
const validateUser = [required(), maxLength(253), regex(/^[a-z0-9._=\-/]+$/, "synapseadmin.users.invalid_user_id")];

const validateAddress = [required(), maxLength(255)];

const UserEditActions = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  const ownUserId = localStorage.getItem("user_id");
  let ownUserIsSelected = false;
  let asManagedUserIsSelected = false;
  if (record && record.id) {
    ownUserIsSelected = record.id === ownUserId;
    asManagedUserIsSelected = isASManaged(record.id);
  }

  return (
    <TopToolbar>
      {!record?.deactivated && <ServerNoticeButton />}
      {record && record.id && (
      <UserPreventSelfDelete ownUserIsSelected={ownUserIsSelected} asManagedUserIsSelected={asManagedUserIsSelected}>
        <DeleteUserButton
          selectedIds={[record?.id]}
          confirmTitle="resources.users.helper.erase"
          confirmContent="resources.users.helper.erase_text"
        />
      </UserPreventSelfDelete>
      )}
    </TopToolbar>
  );
};

export const UserCreate = (props: CreateProps) => (
  <Create
    {...props}
    redirect={(resource: string | undefined, id: Identifier | undefined) => `${resource}/${id}`}
  >
    <SimpleForm>
      <TextInput source="id" autoComplete="off" validate={validateUser} />
      <TextInput source="displayname" validate={maxLength(256)} />
      <PasswordInput source="password" autoComplete="new-password" validate={maxLength(512)} />
      <SelectInput source="user_type" choices={choices_type} translateChoice={false} resettable />
      <BooleanInput source="admin" />
      <ArrayInput source="threepids">
        <SimpleFormIterator disableReordering>
          <SelectInput source="medium" choices={choices_medium} validate={required()} />
          <TextInput source="address" validate={validateAddress} />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput source="external_ids" label="synapseadmin.users.tabs.sso">
        <SimpleFormIterator disableReordering>
          <TextInput source="auth_provider" validate={required()} />
          <TextInput source="external_id" label="resources.users.fields.id" validate={required()} />
        </SimpleFormIterator>
      </ArrayInput>
    </SimpleForm>
  </Create>
);

const UserTitle = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  if (!record) {
    return null;
  }

  let username = record ? (record.displayname ? `"${record.displayname}"` : `"${record.name}"`) : ""
  if (isASManaged(record?.id)) {
    username += " 🤖";
  }
  return (
    <span>
      {translate("resources.users.name", {
        smart_count: 1,
      })}{" "}
      {username}
    </span>
  );
};

const UserEditToolbar = () => {
  const record = useRecordContext();
  const ownUserId = localStorage.getItem("user_id");
  let ownUserIsSelected = false;
  let asManagedUserIsSelected = false;
  if (record && record.id) {
    ownUserIsSelected = record.id === ownUserId;
    asManagedUserIsSelected = isASManaged(record.id);
  }

  return (
    <>
      <div className={ToolbarClasses.defaultToolbar}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <SaveButton />
          <UserPreventSelfDelete ownUserIsSelected={ownUserIsSelected} asManagedUserIsSelected={asManagedUserIsSelected}>
            <DeleteButton />
          </UserPreventSelfDelete>
        </Toolbar>
      </div>
    </>
  );
};

const UserBooleanInput = props => {
  const record = useRecordContext();
  const ownUserId = localStorage.getItem("user_id");
  let ownUserIsSelected = false;
  let asManagedUserIsSelected = false;
  if (record) {
    ownUserIsSelected = record.id === ownUserId;
    asManagedUserIsSelected = isASManaged(record.id);
  }

  return (
    <UserPreventSelfDelete ownUserIsSelected={ownUserIsSelected} asManagedUserIsSelected={asManagedUserIsSelected}>
      <BooleanInput {...props} disabled={ownUserIsSelected || asManagedUserIsSelected} />
    </UserPreventSelfDelete>
  );
};

const UserPasswordInput = props => {
  const record = useRecordContext();
  let asManagedUserIsSelected = false;

  // Get form context to update field value
  const form = useFormContext();
  if (record) {
    asManagedUserIsSelected = isASManaged(record.id);
  }

  const generatePassword = () => {
    const password = generateRandomPassword();
    if (record) {
      form.setValue("password", password, { shouldDirty: true });
    }
  };

  return (
    <>
      <PasswordInput {...props} helperText="resources.users.helper.modify_managed_user_error"
        {...(asManagedUserIsSelected ? { disabled: true } : {})}
       />
       <Button
        variant="outlined"
        label="Generate Password"
        onClick={generatePassword}
        sx={{ marginBottom: "10px" }}
        disabled={asManagedUserIsSelected}
      />
    </>
  );
};

export const UserEdit = (props: EditProps) => {
  const translate = useTranslate();

  return (
    <Edit {...props} title={<UserTitle />} actions={<UserEditActions />} mutationMode="pessimistic" queryOptions={{
      meta: {
        include: ["features"] // Tell your dataProvider to include features
      }
    }}>
      <TabbedForm toolbar={<UserEditToolbar />}>
        <FormTab label={translate("resources.users.name", { smart_count: 1 })} icon={<PersonPinIcon />}>
          <AvatarField source="avatar_src" sx={{ height: "120px", width: "120px" }} />
          <BooleanInput source="avatar_erase" label="resources.users.action.erase_avatar" />
          <ImageInput
            source="avatar_file"
            label="resources.users.fields.avatar"
            accept={{ "image/*": [".png", ".jpg"] }}
          >
            <ImageField source="src" title="Avatar" sx={{ '& img': {
              width: "120px !important",
              height: "120px !important",
              objectFit: "cover !important",
              borderRadius: '50% !important',
            }}} />
          </ImageInput>
          <TextInput source="id" readOnly />
          <TextInput source="displayname" />
          <UserPasswordInput source="password" autoComplete="new-password" helperText="resources.users.helper.password" />
          <SelectInput source="user_type" choices={choices_type} translateChoice={false} resettable />
          <BooleanInput source="admin" />
          <UserBooleanInput source="locked" />
          <UserBooleanInput source="deactivated" helperText="resources.users.helper.deactivate" />
          <BooleanInput source="erased" disabled />
          <DateField source="creation_ts_ms" showTime options={DATE_FORMAT} />
          <TextField source="consent_version" />
        </FormTab>

        <FormTab label="resources.users.threepid" icon={<ContactMailIcon />} path="threepid">
          <ArrayInput source="threepids">
            <SimpleFormIterator disableReordering>
              <SelectInput source="medium" choices={choices_medium} />
              <TextInput source="address" />
            </SimpleFormIterator>
          </ArrayInput>
        </FormTab>

        <FormTab label="synapseadmin.users.tabs.sso" icon={<AssignmentIndIcon />} path="sso">
          <ArrayInput source="external_ids" label={false}>
            <SimpleFormIterator disableReordering>
              <TextInput source="auth_provider" validate={required()} />
              <TextInput source="external_id" label="resources.users.fields.id" validate={required()} />
            </SimpleFormIterator>
          </ArrayInput>
        </FormTab>

        <FormTab label={translate("resources.devices.name", { smart_count: 2 })} icon={<DevicesIcon />} path="devices">
          <ReferenceManyField reference="devices" target="user_id" label={false}>
            <Datagrid style={{ width: "100%" }} bulkActionButtons={false}>
              <TextField source="device_id" sortable={false} />
              <TextField source="display_name" sortable={false} />
              <TextField source="last_seen_ip" sortable={false} />
              <DateField source="last_seen_ts" showTime options={DATE_FORMAT} sortable={false} />
              <DeviceRemoveButton />
            </Datagrid>
          </ReferenceManyField>
        </FormTab>

        <FormTab label="resources.connections.name" icon={<SettingsInputComponentIcon />} path="connections">
          <ReferenceField reference="connections" source="id" label={false} link={false}>
            <ArrayField source="devices[].sessions[0].connections" label="resources.connections.name">
              <Datagrid style={{ width: "100%" }} bulkActionButtons={false}>
                <TextField source="ip" sortable={false} />
                <DateField source="last_seen" showTime options={DATE_FORMAT} sortable={false} />
                <TextField source="user_agent" sortable={false} style={{ width: "100%" }} />
              </Datagrid>
            </ArrayField>
          </ReferenceField>
        </FormTab>

        <FormTab
          label={translate("resources.users_media.name", { smart_count: 2 })}
          icon={<PermMediaIcon />}
          path="media"
        >
          <ReferenceManyField
            reference="users_media"
            target="user_id"
            label={false}
            pagination={<UserPagination />}
            perPage={50}
            sort={{ field: "created_ts", order: "DESC" }}
          >
            <Datagrid style={{ width: "100%" }}>
              <MediaIDField source="media_id" />
              <DateField source="created_ts" showTime options={DATE_FORMAT} />
              <DateField source="last_access_ts" showTime options={DATE_FORMAT} />
              <NumberField source="media_length" />
              <TextField source="media_type" sx={{ display: "block", width: 200, wordBreak: "break-word" }} />
              <FunctionField source="upload_name" render={record => decodeURIComponent(record.upload_name)} />
              <TextField source="quarantined_by" />
              <QuarantineMediaButton label="resources.quarantine_media.action.name" />
              <ProtectMediaButton label="resources.users_media.fields.safe_from_quarantine" />
              <DeleteButton mutationMode="pessimistic" redirect={false} />
            </Datagrid>
          </ReferenceManyField>
        </FormTab>

        <FormTab label={translate("resources.rooms.name", { smart_count: 2 })} icon={<ViewListIcon />} path="rooms">
          <ReferenceManyField reference="joined_rooms" target="user_id" label={false}>
            <Datagrid style={{ width: "100%" }} rowClick={id => "/rooms/" + id + "/show"} bulkActionButtons={false}>
              <TextField source="id" sortable={false} label="resources.rooms.fields.room_id" />
              <ReferenceField
                label="resources.rooms.fields.name"
                source="id"
                reference="rooms"
                sortable={false}
                link=""
              >
                <TextField source="name" sortable={false} />
              </ReferenceField>
            </Datagrid>
          </ReferenceManyField>
        </FormTab>

        <FormTab
          label={translate("resources.pushers.name", { smart_count: 2 })}
          icon={<NotificationsIcon />}
          path="pushers"
        >
          <ReferenceManyField reference="pushers" target="user_id" label={false}>
            <Datagrid style={{ width: "100%" }} bulkActionButtons={false}>
              <TextField source="kind" sortable={false} />
              <TextField source="app_display_name" sortable={false} />
              <TextField source="app_id" sortable={false} />
              <TextField source="data.url" sortable={false} />
              <TextField source="device_display_name" sortable={false} />
              <TextField source="lang" sortable={false} />
              <TextField source="profile_tag" sortable={false} />
              <TextField source="pushkey" sortable={false} />
            </Datagrid>
          </ReferenceManyField>
        </FormTab>

        <FormTab label="Experimental" icon={<ScienceIcon />} path="experimental">
          <ExperimentalFeaturesList />
        </FormTab>
      </TabbedForm>
    </Edit>
  );
};

const resource: ResourceProps = {
  name: "users",
  icon: UserIcon,
  list: UserList,
  edit: UserEdit,
  create: UserCreate,
};

export default resource;
