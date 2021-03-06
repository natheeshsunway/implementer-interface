import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  addSourceMap,
  blurControl,
  deselectControl,
  dragSourceUpdate,
  focusControl,
  generateTranslations,
  selectControl,
} from 'form-builder/actions/control';
import { ComponentStore, Draggable } from 'bahmni-form-controls';
import { Exception } from 'form-builder/helpers/Exception';
import { formBuilderConstants } from 'form-builder/constants';
import { getConceptFromMetadata } from 'form-builder/helpers/componentMapper';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import classNames from 'classnames';
import DeleteControlModal from 'form-builder/components/DeleteControlModal.jsx';
import DragDropHelper from '../helpers/dragDropHelper.js';

export class ControlWrapper extends Draggable {
  constructor(props) {
    super(props);
    this.control = ComponentStore.getDesignerComponent(props.metadata.type).control;
    this.props = props;
    this.metadata = Object.assign({}, props.metadata);
    this.onSelected = this.onSelected.bind(this);
    this.childControl = undefined;
    const isBeingDragged = props.parentRef ? props.parentRef.props.isBeingDragged : false;
    this.state = { active: false, showDeleteModal: false, isBeingDragged };
    this.storeChildRef = this.storeChildRef.bind(this);
    this.getJsonDefinition = this.getJsonDefinition.bind(this);
    this.processDragStart = this.processDragStart.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.clearSelectedControl = this.clearSelectedControl.bind(this);
    this.clearControlProperties = this.clearControlProperties.bind(this);
    this.confirmDelete = this.confirmDelete.bind(this);
    this.closeDeleteModal = this.closeDeleteModal.bind(this);
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleControlDrop = this.handleControlDrop.bind(this);
    this.controlEventFor = this.controlEventFor.bind(this);
  }

  onSelected(event, metadata) {
    const newMetadata = metadata;
    if (metadata.properties && metadata.properties.controlEvent) {
      newMetadata.properties.controlEvent = false;
    }
    this.props.dispatch(selectControl(newMetadata));
    event.stopPropagation();
  }

  clearSelectedControl(event) {
    this.props.dispatch(deselectControl());
    this.props.dispatch(blurControl());
    event.stopPropagation();
  }

  componentWillReceiveProps(nextProps) {
    this.updateEvents(nextProps, this.props, this.metadata.id);
    const activeControl = (this.metadata.id === nextProps.focusedControl);
    if (!activeControl && nextProps.parentRef) {
      this.setState({ isBeingDragged: nextProps.parentRef.props.isBeingDragged });
    }
    this.setState({ active: activeControl });
  }

  updateEvents(nextProps, prevProps, metadataId) {
    if (nextProps.allObsControlEvents && prevProps.allObsControlEvents) {
      const newControl = nextProps.allObsControlEvents.find(control => control.id === metadataId);
      const oldControl = prevProps.allObsControlEvents.find(control => control.id === metadataId);
      if (newControl && oldControl) {
        if (newControl.events !== oldControl.events) {
          this.metadata.events = newControl && newControl.events;
        }
      }
    }
  }

  conditionallyAddConcept(newProps) {
    const concept = get(newProps.conceptToControlMap, this.metadata.id);
    if (concept && !this.metadata.concept && this.control.injectConceptToMetadata) {
      const newMetadata = this.control.injectConceptToMetadata(
        this.metadata,
        concept,
        this.props.idGenerator
      );
      this.metadata = newMetadata;
      this.props.dispatch(selectControl(this.metadata, true));
    }
  }

  updateProperties(newProps) {
    const controlProperty = newProps.controlProperty;
    if (controlProperty && this.metadata.id === controlProperty.id) {
      const childMetadata = (this.metadata.type === 'section') ?
        this.metadata : this.childControl.getJsonDefinition();
      const childProperties = childMetadata.properties;
      const updatedProperties = Object.assign({}, childProperties, controlProperty.property);
      if (!isEqual(this.metadata.properties, updatedProperties)) {
        this.metadata = Object.assign({}, this.metadata, { properties: updatedProperties });
        this.props.dispatch(selectControl(this.metadata));
      }
    }
  }

  componentDidMount() {
    if (this.props.metadata && this.props.metadata.id && this.props.metadata.concept) {
      this.props.dispatch(addSourceMap(getConceptFromMetadata(this.props.metadata)));
    }
  }

  componentWillUpdate(newProps) {
    if (this.metadata.id !== newProps.metadata.id
      || this.metadata.controls !== newProps.metadata.controls) {
      this.metadata = Object.assign({}, this.metadata, { controls: newProps.metadata.controls });
      this.control = ComponentStore.getDesignerComponent(this.metadata.type).control;
    }
    this.conditionallyAddConcept(newProps);
    this.updateProperties(newProps);
  }

  controlEventFor(controlId) {
    const control = this.props.allObsControlEvents.find(obsControl => obsControl.id === controlId);
    return control && control.events;
  }

  getJsonDefinition(isBeingMoved) {
    if (this.childControl) {
      const controlJsonDefinition = this.childControl.getJsonDefinition();
      if (controlJsonDefinition === undefined && !isBeingMoved) {
        const conceptMissingMessage = formBuilderConstants.exceptionMessages.conceptMissing;
        throw new Exception(conceptMissingMessage);
      }
      this.props.dispatch(generateTranslations(controlJsonDefinition));
      if (this.props.allObsControlEvents) {
        controlJsonDefinition.events = this.controlEventFor(this.metadata.id);
      }
      return controlJsonDefinition;
    }
    return undefined;
  }

  processDragStart() {
    const metadata = this.getJsonDefinition(true);
    return metadata || this.props.metadata;
  }

  storeChildRef(ref) {
    if (ref) {
      this.childControl = ref;
    }
  }

  onFocus(event) {
    this.props.dispatch(focusControl(this.metadata.id));
    event.stopPropagation();
  }

  clearControlProperties() {
    this.props.dispatch(deselectControl());
  }

  confirmDelete() {
    this.setState({ showDeleteModal: true });
  }

  closeDeleteModal() {
    this.setState({ showDeleteModal: false });
  }

  showDeleteControlModal() {
    if (this.state.showDeleteModal) {
      return (
        <DeleteControlModal
          closeModal={() => this.closeDeleteModal()}
          controlId={this.props.metadata.id}
          controlName={this.props.metadata.name}
          deleteControl={this.props.deleteControl}
          dispatch={this.props.dispatch}
        />
      );
    }
    return null;
  }

  handleDragStart(e, onDragStart) {
    this.setState({ isBeingDragged: true });
    this.props.dispatch(dragSourceUpdate(this.props.parentRef));
    onDragStart(e);
  }

  handleControlDrop({ metadata, successCallback, dropCell }) {
    DragDropHelper.processControlDrop({ dragSourceCell: this.props.dragSourceCell,
      successfulDropCallback: successCallback, dropCell, metadata });
    this.props.dispatch(dragSourceUpdate(undefined));
  }

  render() {
    const onDragStart = this.onDragStart(this.metadata);
    const draggable = this.props.dragAllowed !== undefined ?
      this.props.dragAllowed.toString() : true;
    return (
      <div
        className={
          classNames('control-wrapper', { 'control-selected': this.state.active }, 'clearfix')
        }
        draggable={draggable}
        onDragStart={ (e) => this.handleDragStart(e, onDragStart)}
        onFocus={(e) => this.onFocus(e)}
        tabIndex="1"
      >
        <this.control
          clearSelectedControl={ this.clearSelectedControl}
          deleteControl={ this.confirmDelete }
          dispatch={this.clearControlProperties}
          dragSourceCell= {this.props.dragSourceCell}
          idGenerator={ this.props.idGenerator}
          isBeingDragged= {this.state.isBeingDragged}
          metadata={ this.metadata }
          onControlDrop={this.handleControlDrop}
          onSelect={ this.onSelected }
          ref={ this.storeChildRef }
          setError={this.props.setError}
          showDeleteButton={ this.props.showDeleteButton && this.state.active }
          wrapper={ this.props.wrapper }

        />
        { this.showDeleteControlModal() }
      </div>
    );
  }
}

ControlWrapper.propTypes = {
  controlProperty: PropTypes.shape({
    id: PropTypes.string,
    property: PropTypes.object,
  }),
  deleteControl: PropTypes.func,
  dragSourceCell: PropTypes.object,
  formDetails: PropTypes.shape({
    events: PropTypes.object,
  }),
  metadata: PropTypes.object,
  setError: PropTypes.func,
  showDeleteButton: PropTypes.bool,
  wrapper: PropTypes.object,
};

function mapStateToProps(state) {
  return {
    conceptToControlMap: state.conceptToControlMap,
    controlProperty: state.controlProperty,
    formDetails: state.formDetails,
    focusedControl: state.controlDetails.focusedControl,
    selectedControl: state.controlDetails.selectedControl,
    dragSourceCell: state.controlDetails.dragSourceCell,
    allObsControlEvents: state.controlDetails.allObsControlEvents,
  };
}

export default connect(mapStateToProps, null, null, { forwardRef: true })(ControlWrapper);
